import { Hono } from "hono";

import { handler as authLogout } from "./handlers/get-auth-logout.ts";
import { handler as authToken } from "./handlers/get-auth-token.ts";
import { handler as authWhoami } from "./handlers/get-auth-whoami.ts";
import { handler as authStage } from "./handlers/get-auth-stage.ts";
import { handler as collections } from "./handlers/get-collections.ts";
import { handler as collectionById } from "./handlers/get-collection-by-id.ts";
import { handler as fileSetById } from "./handlers/get-file-set-by-id.ts";
import { handler as fileSetAnnotations } from "./handlers/get-file-set-annotations.ts";
import { handler as fileSetSearch } from "./handlers/get-file-set-search.ts";
import { handler as annotationById } from "./handlers/get-annotation-by-id.ts";
import { handler as fileSetAuth } from "./handlers/get-file-set-auth.ts";
import { handler as fileSetDownload } from "./handlers/get-file-set-download.ts";
import { handler as providerCapabilities } from "./handlers/get-provider-capabilities.ts";
import { handler as workAuth } from "./handlers/get-work-auth.ts";
import { handler as workById } from "./handlers/get-work-by-id.ts";
import { handler as thumbnail } from "./handlers/get-thumbnail.ts";
import { handler as similar } from "./handlers/get-similar.ts";
import { postSearch, getSearch } from "./handlers/search.ts";
import { handler as sharedLink } from "./handlers/get-shared-link-by-id.ts";
import { handler as oai } from "./handlers/oai.ts";
import { handler as chatEndpoint } from "./handlers/get-chat-endpoint.ts";
import { handler as chatFeedback } from "./handlers/post-chat-feedback.ts";
import { handler as optionsRequest } from "./handlers/options-request.ts";
import { handler as workSearch } from "./handlers/get-work-search.ts";
import middleware from "./handlers/middleware.ts";
import status from "http-status-codes";
import Honeybadger from "@honeybadger-io/js";
import setupHoneybadger from "./honeybadger-setup.ts";
import { handleError } from "./handlers/error-handler.ts";
import type { AppEnv } from "./types.ts";
import "source-map-support/register";

type ErrorWithResponse = Error & {
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: string;
  };
};

const app = new Hono<AppEnv>();

app.use("*", middleware);
app.use("*", async (c, next) => {
  await next();
  if (process.env["DEBUG"]) console.debug("[api.middleware]", c.res.status);
});

app.onError(async (err: ErrorWithResponse, _c) => {
  setupHoneybadger(Honeybadger);
  await handleError(err);

  if (err.response?.status) {
    return new Response(err.response.body ?? null, {
      status: err.response.status,
      headers: err.response.headers,
    });
  }
  return new Response(err.message, {
    status: status.BAD_REQUEST,
    headers: { "content-type": "text/plain" },
  });
});

// auth
app.get("/auth/logout", authLogout);
app.get("/auth/token", authToken);
app.get("/auth/whoami", authWhoami);
app.get("/auth/login", authStage);
app.get("/auth/:stage/:provider", authStage);

// capabilities
app.get("/capabilities/:provider/:feature", providerCapabilities);

// chat
app.get("/chat/endpoint", chatEndpoint);
app.post("/chat/feedback", chatFeedback);

// collections (more specific before general)
app.get("/collections/:id/thumbnail", thumbnail);
app.get("/collections/", collectionById);
app.get("/collections/:id", collectionById);
app.get("/collections", collections);

// annotations
app.get("/annotations/:id", annotationById);

// file-sets (more specific before general)
app.get("/file-sets/:id/annotations", fileSetAnnotations);
app.get("/file-sets/:id/search", fileSetSearch);
app.get("/file-sets/:id/authorization", fileSetAuth);
app.get("/file-sets/:id/download", fileSetDownload);
app.get("/file-sets/:id/thumbnail", thumbnail);
app.get("/file-sets/:id", fileSetById);

// works (more specific before general)
app.get("/works/:id/authorization", workAuth);
app.get("/works/:id/thumbnail", thumbnail);
app.get("/works/:id/similar", similar);
app.get("/works/:id/search", workSearch);
app.get("/works/:id", workById);

// search
app.get("/search/:models", getSearch);
app.get("/search", getSearch);
app.post("/search/:models", postSearch);
app.post("/search", postSearch);

// shared links
app.get("/shared-links/:id", sharedLink);

// oai (GET, HEAD auto-handled, POST explicit)
app.get("/oai", oai);
app.post("/oai", oai);

// OPTIONS catch-all
app.options("/*", (_c) => optionsRequest());

export default app;
