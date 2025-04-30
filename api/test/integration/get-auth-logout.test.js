"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");

const getAuthLogoutHandler = requireSource("handlers/get-auth-logout");
const ApiToken = requireSource("api/api-token");

describe("auth logout", function () {
  helpers.saveEnvironment();

  it("logs a user out of NU WebSSO and expires the DC API Token", async () => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";

    const url = "https://test.com/northwestern#logout";
    nock(process.env.NUSSO_BASE_URL).get("/logout").reply(200, {
      url: url,
    });

    const token = new ApiToken().provider("nusso").sign();
    const event = helpers
      .mockEvent("GET", "/auth/logout")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const result = await getAuthLogoutHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq(url);

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie.value);
    expect(apiToken.token.sub).to.not.exist;
    expect(apiToken.token.isLoggedIn).to.be.false;
    expect(dcApiCookie.Expires).to.eq("Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("expires the DC API Token", async () => {
    const token = new ApiToken().provider("test-provider").sign();
    const event = helpers
      .mockEvent("GET", "/auth/logout")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const result = await getAuthLogoutHandler.handler(event);

    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("/");

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie.value);
    expect(apiToken.token.sub).to.not.exist;
    expect(apiToken.token.isLoggedIn).to.be.false;
    expect(dcApiCookie.Expires).to.eq("Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
