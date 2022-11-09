"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");
const getAuthCallbackHandler = require("../../src/handlers/get-auth-callback");
const ApiToken = require("../../src/api/api-token");

describe("auth callback", function () {
  helpers.saveEnvironment();

  let event;
  beforeEach(() => {
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
        results: [{ uid: "uid123", displayName: ["Some User"] }],
      });

    const result = await getAuthCallbackHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://example.com");

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie);

    expect(apiToken.token.sub).to.eq("uid123");
    expect(apiToken.token.name).to.eq("Some User");
    expect(apiToken.isLoggedIn()).to.be.true;
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

    expect(result.cookies).to.include(
      "redirectUrl=null; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    );

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie);

    expect(apiToken.token.sub).to.eq("uid123");
    expect(apiToken.token.name).to.eq("uid123");
    expect(apiToken.token.email).to.eq("uid123@e.northwestern.edu");
    expect(apiToken.isLoggedIn()).to.be.true;
  });
});
