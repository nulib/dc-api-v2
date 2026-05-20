import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";
import { jwtVerify } from "jose";

// Returns the number of seconds from epoch at approximately now + offset seconds
const fromNowSeconds = (seconds: number) =>
  Math.floor((Date.now() + seconds * 1000) / 1000);

describe("auth token", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("works with anonymous users", async () => {
    const req = buildRequest("GET", "/auth/token");

    const expectedExpiration = fromNowSeconds(86400);
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const body = await result.json();

    // Built-in Date will be in millis and our expiration is in seconds
    const expires = Date.parse(body.expires);
    expect(expires >= (expectedExpiration - 1) * 1000).toBe(true);
    expect(expires <= (expectedExpiration + 1) * 1000).toBe(true);

    const secret = new TextEncoder().encode(process.env["API_TOKEN_SECRET"]);
    const { payload } = await jwtVerify(body.token, secret);
    const exp = payload.exp as number;
    expect(exp >= expectedExpiration - 1).toBe(true);
    expect(exp <= expectedExpiration + 1).toBe(true);
    expect(payload.isLoggedIn).toEqual(false);
  });

  it("returns a token with a default ttl of 1 day", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const req = buildRequest("GET", "/auth/token", {
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });

    const expectedExpiration = fromNowSeconds(86400);
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const body = await result.json();

    const expires = Date.parse(body.expires);
    expect(expires >= (expectedExpiration - 1) * 1000).toBe(true);
    expect(expires <= (expectedExpiration + 1) * 1000).toBe(true);

    const secret = new TextEncoder().encode(process.env["API_TOKEN_SECRET"]);
    const { payload } = await jwtVerify(body.token, secret);
    const exp = payload.exp as number;
    expect(exp >= expectedExpiration - 1).toBe(true);
    expect(exp <= expectedExpiration + 1).toBe(true);
    expect(payload.name).toEqual("Some One");
  });

  it("returns a token with the requested ttl", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const ttl = 3600 * 18; // 18 hours
    const req = buildRequest("GET", "/auth/token", {
      queryParams: { ttl: ttl.toString() },
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });

    const expectedExpiration = fromNowSeconds(ttl);
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const body = await result.json();

    const expires = Date.parse(body.expires);
    expect(expires >= (expectedExpiration - 1) * 1000).toBe(true);
    expect(expires <= (expectedExpiration + 1) * 1000).toBe(true);

    const secret = new TextEncoder().encode(process.env["API_TOKEN_SECRET"]);
    const { payload } = await jwtVerify(body.token, secret);
    const exp = payload.exp as number;
    expect(exp >= expectedExpiration - 1).toBe(true);
    expect(exp <= expectedExpiration + 1).toBe(true);
    expect(payload.name).toEqual("Some One");
  });

  it("rejects a request with a non-numeric ttl", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const req = buildRequest("GET", "/auth/token", {
      queryParams: { ttl: "blargh" },
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(400);
    expect(await result.text()).toEqual(
      "'blargh' is not a valid value for ttl",
    );
  });

  it("rejects a request with a ttl that's too high", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const req = buildRequest("GET", "/auth/token", {
      queryParams: { ttl: "864000" },
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(400);
    expect(await result.text()).toEqual("ttl cannot exceed 604800 seconds");
  });
});
