"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");

const getAuthCallbackHandler = requireSource("handlers/get-auth-callback");
const ApiToken = requireSource("api/api-token");

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
      .get("/agentless-websso/validateWebSSOToken")
      .reply(200, { netid: "uid123" });
  });

  it("redeems the NUSSO token", async () => {
    nock(process.env.NUSSO_BASE_URL)
      .get("/directory-search/res/netid/bas/uid123")
      .reply(200, {
        results: [
          {
            displayName: ["Some User"],
            mail: "some.user@example.com",
            eduPersonPrimaryAffiliation: "staff",
          },
        ],
      });

    const result = await getAuthCallbackHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://example.com");

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie.value);

    expect(apiToken.token.sub).to.eq("uid123");
    expect(apiToken.token.name).to.eq("Some User");
    expect(apiToken.token.email).to.eq("some.user@example.com");
    expect(apiToken.token.primaryAffiliation).to.eq("staff");
    expect(apiToken.isLoggedIn()).to.be.true;
  });

  it("fills in the blanks if the directory search result is incomplete", async () => {
    nock(process.env.NUSSO_BASE_URL)
      .get("/directory-search/res/netid/bas/uid123")
      .reply(200, {
        results: [{ displayName: [], mail: "" }],
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

    const apiToken = new ApiToken(dcApiCookie.value);

    expect(apiToken.token.sub).to.eq("uid123");
    expect(apiToken.token.name).to.eq("uid123");
    expect(apiToken.token.email).to.eq("uid123@e.northwestern.edu");
    expect(apiToken.token.primaryAffiliation).to.be.undefined;
    expect(apiToken.isLoggedIn()).to.be.true;
  });

  it("assembles a user object from the netID if directory search fails", async () => {
    nock(process.env.NUSSO_BASE_URL)
      .get("/directory-search/res/netid/bas/uid123")
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

    const apiToken = new ApiToken(dcApiCookie.value);

    expect(apiToken.token.sub).to.eq("uid123");
    expect(apiToken.token.name).to.eq("uid123");
    expect(apiToken.token.email).to.eq("uid123@e.northwestern.edu");
    expect(apiToken.isLoggedIn()).to.be.true;
  });
});
