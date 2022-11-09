"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");
const getAuthLogoutHandler = require("../../src/handlers/get-auth-logout");

describe("auth logout", function () {
  helpers.saveEnvironment();

  it("logs a user out of NU WebSSO and expires the DC API Token", async () => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";

    const url = "https://test.com/northwestern#logout";
    nock(process.env.NUSSO_BASE_URL).get("/logout").reply(200, {
      url: url,
    });

    const event = helpers.mockEvent("GET", "/auth/logout").render();

    const result = await getAuthLogoutHandler.handler(event);
    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq(url);
    expect(result.cookies[0]).to.contain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT;"
    );
  });
});
