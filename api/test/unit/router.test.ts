import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import app from "../../src/app.ts";
import { setupEnv, teardownEnv } from "../test-helpers/index.ts";

// Snapshot the route table once — it's static.
const routes = app.routes.map((r) => `${r.method} ${r.path}`);

describe("Hono app routing", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  describe("unknown routes", () => {
    it("returns 404 for an unknown path", async () => {
      const res = await app.request("/nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns 404 for a known path with the wrong method", async () => {
      // Hono's default router returns 404 (not 405) for method mismatches.
      const res = await app.request("/works/abc-123", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("route table — all routes are registered", () => {
    it.each([
      ["GET", "/auth/logout"],
      ["GET", "/auth/token"],
      ["GET", "/auth/whoami"],
      ["GET", "/auth/login"],
      ["GET", "/auth/:stage/:provider"],
      ["GET", "/capabilities/:provider/:feature"],
      ["GET", "/chat/endpoint"],
      ["POST", "/chat/feedback"],
      ["GET", "/collections/:id/thumbnail"],
      ["GET", "/collections/:id"],
      ["GET", "/collections"],
      ["GET", "/annotations/:id"],
      ["GET", "/file-sets/:id/annotations"],
      ["GET", "/file-sets/:id/authorization"],
      ["GET", "/file-sets/:id/download"],
      ["GET", "/file-sets/:id"],
      ["GET", "/works/:id/authorization"],
      ["GET", "/works/:id/thumbnail"],
      ["GET", "/works/:id/similar"],
      ["GET", "/works/:id"],
      ["GET", "/search/:models"],
      ["GET", "/search"],
      ["POST", "/search/:models"],
      ["POST", "/search"],
      ["GET", "/shared-links/:id"],
      ["GET", "/oai"],
      ["POST", "/oai"],
      ["OPTIONS", "/*"],
    ])("%s %s is registered", (method, path) => {
      expect(routes).toContain(`${method} ${path}`);
    });
  });

  describe("route precedence (more specific before more general)", () => {
    it("routes /works/:id/thumbnail before /works/:id", () => {
      expect(routes.indexOf("GET /works/:id/thumbnail")).toBeLessThan(
        routes.indexOf("GET /works/:id"),
      );
    });

    it("routes /works/:id/similar before /works/:id", () => {
      expect(routes.indexOf("GET /works/:id/similar")).toBeLessThan(
        routes.indexOf("GET /works/:id"),
      );
    });

    it("routes /works/:id/authorization before /works/:id", () => {
      expect(routes.indexOf("GET /works/:id/authorization")).toBeLessThan(
        routes.indexOf("GET /works/:id"),
      );
    });

    it("routes /collections/:id/thumbnail before /collections/:id", () => {
      expect(routes.indexOf("GET /collections/:id/thumbnail")).toBeLessThan(
        routes.indexOf("GET /collections/:id"),
      );
    });

    it("routes /file-sets/:id/annotations before /file-sets/:id", () => {
      expect(routes.indexOf("GET /file-sets/:id/annotations")).toBeLessThan(
        routes.indexOf("GET /file-sets/:id"),
      );
    });

    it("routes /auth/login before /auth/:stage/:provider", () => {
      expect(routes.indexOf("GET /auth/login")).toBeLessThan(
        routes.indexOf("GET /auth/:stage/:provider"),
      );
    });

    it("registers OPTIONS /* as the last route", () => {
      expect(routes.indexOf("OPTIONS /*")).toBe(routes.length - 1);
    });
  });

  describe("OPTIONS catch-all", () => {
    it("returns 204 for OPTIONS on any path", async () => {
      const res = await app.request("/works/abc-123", {
        method: "OPTIONS",
        headers: { origin: "https://dc.library.northwestern.edu" },
      });
      expect(res.status).toBe(204);
    });

    it("returns 204 for OPTIONS on a deeply nested path", async () => {
      const res = await app.request("/some/deeply/nested/path", {
        method: "OPTIONS",
        headers: { origin: "https://dc.library.northwestern.edu" },
      });
      expect(res.status).toBe(204);
    });

    it("adds CORS headers to OPTIONS responses", async () => {
      const res = await app.request("/works/abc-123", {
        method: "OPTIONS",
        headers: { origin: "https://dc.library.northwestern.edu" },
      });
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://dc.library.northwestern.edu",
      );
    });
  });
});
