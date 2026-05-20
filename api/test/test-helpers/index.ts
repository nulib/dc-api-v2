import { readFileSync } from "fs";
import app from "../../src/app.ts";

export const TEST_BASE = "https://api.test.library.northwestern.edu";
export const TEST_OPENSEARCH_HOST = "index.test.library.northwestern.edu";

/** Build a full URL for an OpenSearch/IIIF path (same host), for use in MSW handlers. */
export function osUrl(path: string | RegExp): string | RegExp {
  if (path instanceof RegExp) {
    // Strip leading ^ and trailing $ anchors before embedding in the full-URL pattern
    const src = path.source.replace(/^\^/, "").replace(/\$$/, "");
    return new RegExp(
      `^https://${TEST_OPENSEARCH_HOST}(?:/[^?]*)?${src}(?:\\?.*)?$`,
    );
  }
  return `https://${TEST_OPENSEARCH_HOST}${path}`;
}

/** Build a full URL for a NUSSO path, for use in MSW handlers. */
export function nussoUrl(nussoBaseUrl: string, path: string): string {
  return `${nussoBaseUrl.replace(/\/$/, "")}${path}`;
}

export const TestEnvironment: Record<string, string> = {
  API_TOKEN_SECRET: "abc123",
  API_TOKEN_NAME: "dcapiTEST",
  ENV_PREFIX: "",
  DC_URL: "https://thisisafakedcurl",
  DC_API_ENDPOINT: "https://thisisafakeapiurl",
  DEV_TEAM_NET_IDS: "abc123,def456",
  NUSSO_BASE_URL: "https://nusso-base.com/",
  NUSSO_API_KEY: "abc123",
  WEBSOCKET_URI: "wss://thisisafakewebsocketapiurl",
  CHAT_FEEDBACK_BUCKET: "test-chat-feedback-bucket",
  DEFAULT_SEARCH_SIZE: "10",
  PROVIDER_CAPABILITIES:
    '{"magic":["chat", "login"],"nusso":["chat", "login"]}',
  HONEYBADGER_DISABLED: "true",
  HONEYBADGER_ENV: "test",
  READING_ROOM_IPS: "",
  __SKIP_SECRETS__: "true",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  AWS_REGION: "us-east-1",
  OPENSEARCH_ENDPOINT: TEST_OPENSEARCH_HOST,
};

let _savedEnv: Record<string, string | undefined> = {};

export function setupEnv(overrides: Record<string, string> = {}): void {
  _savedEnv = {};
  const env = { ...TestEnvironment, ...overrides };
  for (const [k, v] of Object.entries(env)) {
    _savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
}

export function teardownEnv(): void {
  for (const [k, v] of Object.entries(_savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  _savedEnv = {};
}

export function testFixture(file: string): string {
  return readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf-8");
}

export function testFixtureBytes(file: string): Uint8Array {
  const buf = readFileSync(new URL(`../fixtures/${file}`, import.meta.url));
  return new Uint8Array(buf);
}

export function encodedFixture(file: string): string {
  const bytes = testFixtureBytes(file);
  return btoa(String.fromCharCode(...bytes));
}

export function cookieValue(
  cookies: string[],
  cookieName: string,
): Record<string, string> {
  const result: Record<string, string> = { value: "" };
  const regex = new RegExp(`^${cookieName}=(?<value>[^;]+)(?<props>.+)?$`);
  for (const c of cookies) {
    const match = regex.exec(c);
    if (match) {
      const { value, props } = match.groups!;
      result.value = value;
      if (props) {
        for (const prop of props.split(/;\s+/)) {
          const [propKey, propValue] = prop.split(/=/);
          if (propKey) result[propKey] = propValue;
        }
      }
    }
  }
  return result;
}

export interface RequestOptions {
  pathParams?: Record<string, string | number>;
  queryParams?: Record<string, string | number>;
  headers?: Record<string, string>;
  body?: string | object;
  base64Encode?: boolean;
  cookies?: Array<[string, string]>;
  sourceIp?: string;
}

export function buildRequest(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Request {
  const {
    pathParams = {},
    queryParams = {},
    headers = {},
    body,
    base64Encode,
    cookies = [],
    sourceIp = "10.9.8.7",
  } = opts;

  let resolvedPath = path;
  for (const [k, v] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(`{${k}}`, String(v));
  }

  const url = new URL(resolvedPath, TEST_BASE);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, String(v));
  }

  const reqHeaders = new Headers({
    host: "api.test.library.northwestern.edu",
    forwarded: `for=${sourceIp}; proto=https; host=api.test.library.northwestern.edu; by=proxy.northwestern.edu, for=10.6.5.4; proto=https; host=proxy.northwestern.edu; by=some-other-proxy.example.com`,
    ...headers,
  });

  if (cookies.length > 0) {
    const existing = reqHeaders.get("cookie") ?? "";
    const added = cookies
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("; ");
    reqHeaders.set("cookie", existing ? `${existing}; ${added}` : added);
  }

  let reqBody: BodyInit | null = null;
  if (body !== undefined) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    reqBody = base64Encode ? btoa(bodyStr) : bodyStr;
  }

  const req = new Request(url.toString(), {
    method,
    headers: reqHeaders,
    body: method !== "GET" && method !== "HEAD" ? reqBody : null,
  });

  const resolvedPathParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(pathParams)) {
    resolvedPathParams[k] = String(v);
  }

  return req;
}

export async function sendRequest(req: Request): Promise<Response> {
  return app.request(req);
}
