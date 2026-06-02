import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { SignJWT } from "jose";
import {
  baseUrl,
  decodeToken,
  isFromReadingRoom,
} from "../../../src/helpers.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";
import type { Context } from "hono";

/** Create a minimal Hono Context duck-type from a plain Request for unit-testing helpers. */
function makeContext(req: Request): Context {
  return {
    req: {
      header: (name: string) => req.headers.get(name) ?? undefined,
      method: req.method,
      url: req.url,
    },
  } as unknown as Context;
}

describe("helpers", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  describe("baseUrl()", () => {
    it("extracts the base URL from a local event", () => {
      const req = new Request("http://localhost:3000/route/value", {
        headers: {
          host: "localhost",
          "x-forwarded-proto": "http",
          "x-forwarded-port": "3000",
        },
      });
      expect(baseUrl(makeContext(req))).toEqual(
        "http://localhost:3000/api/v2/",
      );
    });

    it("extracts the base URL from an API Gateway event", () => {
      const req = new Request(
        "https://abcdefghijz.execute-api.us-east-1.amazonaws.com/route/value",
        {
          headers: {
            host: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
            "x-forwarded-proto": "https",
            "x-forwarded-port": "443",
          },
        },
      );
      expect(baseUrl(makeContext(req))).toEqual(
        "https://abcdefghijz.execute-api.us-east-1.amazonaws.com/api/v2/",
      );
    });

    it("extracts the base URL from a CloudFront event", () => {
      const req = new Request(
        "https://abcdefghijz.cloudfront.net/route/value",
        {
          headers: {
            host: "abcdefghijz.cloudfront.net",
            "x-forwarded-proto": "https",
            "x-forwarded-port": "443",
          },
        },
      );
      expect(baseUrl(makeContext(req))).toEqual(
        "https://abcdefghijz.cloudfront.net/api/v2/",
      );
    });

    it("extracts the base URL from an event with a custom domain", () => {
      const req = new Request(
        "https://api.test.library.northwestern.edu/route/value",
        {
          headers: {
            host: "api.test.library.northwestern.edu",
            "x-forwarded-proto": "https",
            "x-forwarded-port": "443",
          },
        },
      );
      expect(baseUrl(makeContext(req))).toEqual(
        "https://api.test.library.northwestern.edu/api/v2/",
      );
    });

    it("prefers the x-forwarded-base header if present", () => {
      const req = new Request(
        "https://api.test.library.northwestern.edu/works",
        {
          headers: {
            host: "api.test.library.northwestern.edu",
            "x-forwarded-proto": "https",
            "x-forwarded-port": "443",
            "x-forwarded-base": "https://api.test.library.northwestern.edu/",
          },
        },
      );
      expect(baseUrl(makeContext(req))).toEqual(
        "https://api.test.library.northwestern.edu/",
      );
    });
  });

  describe("isFromReadingRoom()", () => {
    it("knows when a request is coming from a reading room IP", () => {
      expect(isFromReadingRoom("10.9.8.7")).toEqual(false);
      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      expect(isFromReadingRoom("10.9.8.7")).toEqual(true);
    });
  });

  describe("decodeToken()", () => {
    it("identifies a cookie token", async () => {
      const token = new ApiTokenHelper();
      const signedToken = await token.signWith({ sub: "abc123" });
      const tokenName = process.env["API_TOKEN_NAME"] ?? "dcapiTEST";
      const req = new Request("https://example.com/", {
        headers: { cookie: `${tokenName}=${signedToken}` },
      });
      const result = await decodeToken(makeContext(req));
      expect(result.token.sub).toEqual("abc123");
      expect(result.token.isReadingRoom).toEqual(undefined);
    });

    it("identifies a bearer token", async () => {
      const token = new ApiTokenHelper();
      const signedToken = await token.signWith({ sub: "abc123" });
      const req = new Request("https://example.com/", {
        headers: { authorization: `Bearer ${signedToken}` },
      });
      const result = await decodeToken(makeContext(req));
      expect(result.token.sub).toEqual("abc123");
      expect(result.token.isReadingRoom).toEqual(undefined);
    });

    it("prioritizes a bearer token over a cookie token", async () => {
      const helper = new ApiTokenHelper();
      const cookieToken = await helper.signWith({ sub: "abc123" });
      const bearerToken = await helper.signWith({ sub: "def456" });
      const tokenName = process.env["API_TOKEN_NAME"] ?? "dcapiTEST";
      const req = new Request("https://example.com/", {
        headers: {
          authorization: `Bearer ${bearerToken}`,
          cookie: `${tokenName}=${cookieToken}`,
        },
      });
      const result = await decodeToken(makeContext(req));
      expect(result.token.sub).toEqual("def456");
    });

    it("adds an anonymous token if the token is expired", async () => {
      const secret = process.env["API_TOKEN_SECRET"] ?? "abc123";
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        name: "Some One",
        exp: Math.floor(Date.now() / 1000) - 1,
        iat: Math.floor(Date.now() / 1000) - 2,
        email: "user@example.com",
      };
      const expiredToken = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .sign(new TextEncoder().encode(secret));
      const tokenName = process.env["API_TOKEN_NAME"] ?? "dcapiTEST";
      const req = new Request("https://example.com/", {
        headers: { cookie: `${tokenName}=${expiredToken}` },
      });
      const result = await decodeToken(makeContext(req));
      expect(result.token.sub).toEqual(undefined);
    });
  });
});

// Helper class to sign tokens in tests
class ApiTokenHelper {
  async signWith(payload: Record<string, unknown>): Promise<string> {
    const secret = process.env["API_TOKEN_SECRET"] ?? "abc123";
    const fullPayload = {
      iss: "https://example.com",
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      iat: Math.floor(Date.now() / 1000),
      isLoggedIn: !!payload.sub,
      scopes: ["read:Public", "read:Published"],
      entitlements: [],
      ...payload,
    };
    return await new SignJWT(fullPayload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(secret));
  }
}
