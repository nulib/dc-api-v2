"use strict";

const chai = require("chai");
const expect = chai.expect;
const getAuthWhoamiHandler = require("../../src/handlers/get-auth-whoami");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");

describe("auth whoami", function () {
  helpers.saveEnvironment();

  it("redeems a valid NUSSO token", async () => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";

    const payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
    };
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const event = helpers
      .mockEvent("GET", "/auth/whoami")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    expect(JSON.parse(result.body)).to.contain({ name: "Some One" });
  });

  it("Rejects an expired API token", async () => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";

    const payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000),
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
    };
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const event = helpers
      .mockEvent("GET", "/auth/whoami")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    expect(result.statusCode).to.eq(401);
    expect(result.body).to.eq("Error verifying API token: jwt expired");
  });

  it("Issues an anonymous API token if no token is present", async () => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";
    process.env.DC_API_ENDPOINT = "https://fake-dcapi-endpoint";

    const event = helpers
      .mockEvent("GET", "/auth/whoami")

      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    const dcApiToken = cookie.parse(result.cookies[0])[
      process.env.API_TOKEN_NAME
    ];
    const token = jwt.verify(dcApiToken, process.env.API_TOKEN_SECRET);
    expect(token.iss).to.eq("https://fake-dcapi-endpoint");
    expect(token.sub).to.not.exist;

    expect(result.statusCode).to.eq(200);
    expect(JSON.parse(result.body)).to.contain({
      iss: "https://fake-dcapi-endpoint",
    });
  });
});
