"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");

const getAuthLoginHandler = requireSource("handlers/get-auth-stage");

describe("auth login", function () {
  helpers.saveEnvironment();

  beforeEach(() => {
    process.env.NUSSO_BASE_URL = "https://test-nusso.com/";
    process.env.NUSSO_API_KEY = "abc123";

    nock(process.env.NUSSO_BASE_URL)
      .get("/get-ldap-redirect-url")
      .reply(200, { redirecturl: "https://test-redirect.com" });
  });

  it("redirects to the NUSSO url", async () => {
    const event = helpers
      .mockEvent("GET", "/auth/login/nusso")
      .pathParams({ provider: "nusso", stage: "login" })
      .queryParams({ goto: "https://test-goto.com" })
      .render();

    const result = await getAuthLoginHandler.handler(event);
    expect(result.statusCode).to.eq(302);
    console.log(result);
    expect(result.headers.location).to.eq("https://test-redirect.com");
  });

  it("defaults to the NUSSO url", async () => {
    const event = helpers
      .mockEvent("GET", "/auth/login")
      .pathParams({ stage: "login" })
      .queryParams({ goto: "https://test-goto.com" })
      .render();

    const result = await getAuthLoginHandler.handler(event);
    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("https://test-redirect.com");
  });
});
