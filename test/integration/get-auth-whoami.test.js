"use strict";

const chai = require("chai");
const expect = chai.expect;
const getAuthWhoamiHandler = require("../../src/handlers/get-auth-whoami");
const jwt = require("jsonwebtoken");
const ApiToken = require("../../src/api/api-token");
const { processRequest } = require("../../src/handlers/middleware");

describe("auth whoami", function () {
  helpers.saveEnvironment();

  it("redeems a valid NUSSO token for user info", async () => {
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

  it("Replaces an expired token with an anonymous token", async () => {
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
    expect(result.statusCode).to.eq(200);
    expect(JSON.parse(result.body)).not.to.contain({
      sub: "user123",
    });
  });

  it("Issues an anonymous API token if no token is present", async () => {
    const event = helpers.mockEvent("GET", "/auth/whoami").render();

    const result = await getAuthWhoamiHandler.handler(event);
    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );

    const apiToken = new ApiToken(dcApiCookie);
    expect(apiToken.token.iss).to.eq(process.env.DC_API_ENDPOINT);
    expect(apiToken.token.sub).to.not.exist;

    expect(result.statusCode).to.eq(200);
    expect(JSON.parse(result.body)).to.contain({
      iss: process.env.DC_API_ENDPOINT,
    });
    expect(JSON.parse(result.body)).not.to.contain({
      sub: "user123",
    });
  });
});
