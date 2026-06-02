import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  cookieValue,
} from "../test-helpers/index.ts";

describe("auth whoami", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("returns user info", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const req = buildRequest("GET", "/auth/whoami", {
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });

    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const response = await result.json();
    expect(response.name).toEqual("Some One");
    expect("scopes" in response).toBe(true);
  });

  it("Doesn't set a new cookie if the token is not updated", async () => {
    const token = await new ApiToken()
      .user({
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      })
      .sign();

    const req1 = buildRequest("GET", "/auth/whoami", {
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });

    const result = await sendRequest(req1);
    const dcApiCookie = cookieValue(
      result.headers.getSetCookie(),
      process.env["API_TOKEN_NAME"]!,
    );
    // No new cookie should be set — value should be empty string (not found)
    expect(dcApiCookie.value).toEqual("");
  });

  it("Expires the DC API Token and appears anonymous when an expired token is present", async () => {
    // Create a token that is already expired (exp in the past)
    const apiToken = new ApiToken();
    apiToken.token.exp = Math.floor(Date.now() / 1000); // already expired
    apiToken.token.sub = "user123";
    apiToken.token.isLoggedIn = true;
    const token = await apiToken.sign();

    const req = buildRequest("GET", "/auth/whoami", {
      headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
    });

    const result = await sendRequest(req);
    const body = await result.json();

    expect(result.status).toEqual(200);
    expect(body.iss).toEqual(process.env["DC_API_ENDPOINT"]);
    expect(body.isLoggedIn).toEqual(false);
    expect(!("sub" in body) || body.sub !== "user123").toBe(true);

    const dcApiCookie = cookieValue(
      result.headers.getSetCookie(),
      process.env["API_TOKEN_NAME"]!,
    );
    expect(dcApiCookie.Expires).toEqual("Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("Issues an anonymous API token if no token is present", async () => {
    const req = buildRequest("GET", "/auth/whoami");
    const result = await sendRequest(req);
    const body = await result.json();

    expect(result.status).toEqual(200);
    expect(body.iss).toEqual(process.env["DC_API_ENDPOINT"]);
    expect(body.isLoggedIn).toEqual(false);
  });
});
