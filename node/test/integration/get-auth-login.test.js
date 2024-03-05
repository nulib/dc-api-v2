"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");

const getAuthLoginHandler = requireSource("handlers/get-auth-login");

describe("auth login", function () {
  helpers.saveEnvironment();

  it("redirects to the NUSSO url", async () => {
    process.env.NUSSO_BASE_URL = "https://nusso-base.com/";
    process.env.NUSSO_API_KEY = "abc123";

    const gotoUrl = "https://test-goto.com/api/search?=College+sports?ai=true";

    nock(process.env.NUSSO_BASE_URL)
      .get("/get-ldap-redirect-url")
      .reply(200, {
        data: { redirecturl: "https://test-redirect.com" },
      });

    const event = helpers
      .mockEvent("GET", "/auth/login")
      .queryParams({
        goto: gotoUrl,
      })
      .render();

    const result = await getAuthLoginHandler.handler(event);
    expect(result.statusCode).to.eq(302);

    const cookie = result.cookies[0];
    const [cookieName, encodedString] = cookie.split("=");
    expect(cookieName).to.eq("redirectUrl");
    const decoded = Buffer.from(encodedString, "base64").toString("utf8");
    expect(decoded).to.eq(
      "https%3A%2F%2Ftest-goto.com%2Fapi%2Fsearch%3F%3DCollege%2Bsports%3Fai%3Dtrue"
    );
  });
});
