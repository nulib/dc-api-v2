"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");
const getAuthCallbackHandler = require("../../src/handlers/get-auth-callback");

describe("auth callback", function () {
  helpers.saveEnvironment();

  it("redeems the NUSSO token", async () => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";
    process.env.API_TOKEN_SECRET = "abc123";

    const _scope = nock(process.env.NUSSO_BASE_URL)
      .get("/validate-with-directory-search-response")
      .reply(200, {
        results: [{ displayName: "Some User" }],
      });

    const event = helpers
      .mockEvent("GET", "/auth/callback")
      .pathPrefix("/api/v2")
      .headers({
        Cookie: "nusso=bnVzc28=;redirectUrl=aHR0cHM6Ly9leGFtcGxlLmNvbQ==;",
      })
      .render();

    const result = await getAuthCallbackHandler.handler(event);
    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://example.com");
  });
});
