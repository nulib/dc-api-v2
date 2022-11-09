"use strict";

const chai = require("chai");
const cookie = require("cookie");
const expect = chai.expect;
const jwt = require("jsonwebtoken");
const nock = require("nock");
const getAuthCallbackHandler = require("../../src/handlers/get-auth-callback");

describe("auth callback", function () {
  helpers.saveEnvironment();

  let event;
  beforeEach(() => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";

    event = helpers
      .mockEvent("GET", "/auth/callback")
      .headers({
        Cookie: "nusso=bnVzc28=;redirectUrl=aHR0cHM6Ly9leGFtcGxlLmNvbQ==;",
      })
      .render();

    nock(process.env.NUSSO_BASE_URL)
      .get("/validateWebSSOToken")
      .reply(200, { netid: "uid123" });
  });

  it("redeems the NUSSO token", async () => {
    nock(process.env.NUSSO_BASE_URL)
      .get("/validate-with-directory-search-response")
      .reply(200, {
        results: [{ displayName: ["Some User"] }],
      });

    const result = await getAuthCallbackHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://example.com");

    const dcApiToken = cookie.parse(result.cookies[0])[
      process.env.API_TOKEN_NAME
    ];
    const token = jwt.verify(dcApiToken, process.env.API_TOKEN_SECRET);
    expect(token.sub).to.eq("uid123");
    expect(token.name).to.eq("Some User");
  });

  it("assembles a user object from the netID if directory search fails", async () => {
    nock(process.env.NUSSO_BASE_URL)
      .get("/validate-with-directory-search-response")
      .reply(500, {
        fault: {
          faultstring:
            "Execution of ServiceCallout Call-WebSSO-API failed. Reason: ResponseCode 404 is treated as error",
          detail: { errorcode: "steps.servicecallout.ExecutionFailed" },
        },
      });

    const result = await getAuthCallbackHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://example.com");

    const dcApiToken = cookie.parse(result.cookies[0])[
      process.env.API_TOKEN_NAME
    ];
    const token = jwt.verify(dcApiToken, process.env.API_TOKEN_SECRET);
    expect(token.sub).to.eq("uid123");
    expect(token.name).to.eq("uid123");
  });
});
