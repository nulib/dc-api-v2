"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");
const getAuthLoginHandler = require("../../src/handlers/get-auth-login");

describe("auth login", function () {
  helpers.saveEnvironment();

  it("redirects to the NUSSO url", async () => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";

    const _scope = nock(process.env.NUSSO_BASE_URL)
      .get("/get-ldap-redirect-url")
      .reply(200, {
        data: { redirecturl: "https://test-redirect.com" },
      });

    const event = helpers
      .mockEvent("GET", "/auth/login")
      .queryParams({ goto: "https://test-goto.com" })
      .render();

    const result = await getAuthLoginHandler.handler(event);
    expect(result.statusCode).to.eq(302);
  });
});
