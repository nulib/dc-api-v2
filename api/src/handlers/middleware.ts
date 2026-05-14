import {
  BatchGetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { apiTokenName } from "../environment.ts";
import {
  AcceptableHeaders,
  ExposedHeaders,
  decodeToken,
  isFromReadingRoom,
} from "../helpers.ts";
import { normalizeRequest } from "../handlers/forwarded.ts";
import parseHeader from "parse-http-header";
import Honeybadger from "@honeybadger-io/js";

import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { every } from "hono/combine";
import { setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

const TextTypes = new RegExp(/^(application\/(json|(.+\+)?xml)$|text\/)/);

const normalize = createMiddleware(async (c, next) => {
  c.req.raw = normalizeRequest(c.req.raw);
  await next();
});

const environment = createMiddleware(async (c, next) => {
  if (!process.env["__SKIP_SECRETS__"]) {
    const SECRETS_PATH = process.env["SECRETS_PATH"];
    const API_CONFIG_PREFIX = process.env["API_CONFIG_PREFIX"] ?? SECRETS_PATH;
    const SecretPaths = [
      `${API_CONFIG_PREFIX}/config/dcapi`,
      `${SECRETS_PATH}/infrastructure/index`,
      `${SECRETS_PATH}/infrastructure/nusso`,
    ];

    const putenv = (name: string, value: string | undefined): void => {
      if (!process.env[name] && value) process.env[name] = value;
    };

    const client = new SecretsManagerClient();
    const cmd = new BatchGetSecretValueCommand({
      SecretIdList: Object.values(SecretPaths),
    });
    const { SecretValues } = await client.send(cmd);
    const secrets: Record<string, Record<string, string>> = {};
    for (const { Name, SecretString } of SecretValues ?? []) {
      if (Name && SecretString)
        secrets[Name.split("/").reverse()[0]] = JSON.parse(SecretString);
    }

    let endpoint: string = secrets.index?.endpoint;
    if (endpoint && URL.canParse(endpoint)) {
      endpoint = new URL(endpoint).hostname;
    }

    putenv("API_TOKEN_SECRET", secrets.dcapi?.api_token_secret);
    putenv("OPENSEARCH_ENDPOINT", endpoint);
    putenv("OPENSEARCH_MODEL_ID", secrets.index?.embedding_model);
    putenv("NUSSO_API_KEY", secrets.nusso?.api_key);
    putenv("NUSSO_BASE_URL", secrets.nusso?.base_url);
    process.env["__SKIP_SECRETS__"] = "true";
  }
  await next();
});

const authentication = createMiddleware(async (c, next) => {
  let userToken = await decodeToken(c);

  if (isFromReadingRoom(c.req.header("X-Real-Ip") ?? "")) {
    userToken.readingRoom();
  }

  Honeybadger.setContext({ requestContext: c });
  if (process.env["DEBUG"])
    console.debug("[api.middleware]", c.req.method, c.req.url);
  c.set("userToken", userToken);
  await next();
  userToken = c.get("userToken");
  if (userToken?.updated()) {
    const expires = userToken.shouldExpire() ? new Date(0) : undefined;
    setCookie(c, apiTokenName(), await userToken.sign(), {
      domain: "library.northwestern.edu",
      path: "/",
      secure: true,
      expires,
    });
  }
});

const encoding = createMiddleware(async (c, next) => {
  await next();
  const contentType = c.res.headers.get("content-type");

  if (!contentType) {
    c.res.headers.set("content-type", `application/json; charset=UTF-8`);
  } else {
    const parsed = parseHeader(contentType) as Record<string, string>;
    if (parsed && TextTypes.test(parsed[0]) && !parsed.charset) {
      c.res.headers.set("content-type", `${contentType}; charset=UTF-8`);
    }
  }
});

export default every(
  environment,
  normalize,
  authentication,
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: AcceptableHeaders,
    allowMethods: ["POST", "GET", "HEAD", "OPTIONS"],
    credentials: true,
    exposeHeaders: ExposedHeaders,
    maxAge: 600,
  }),
  etag(),
  encoding,
);
