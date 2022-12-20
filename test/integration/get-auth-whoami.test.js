"use strict";

const chai = require("chai");
const expect = chai.expect;
const getAuthWhoamiHandler = require("../../src/handlers/get-auth-whoami");
const jwt = require("jsonwebtoken");

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

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );
    expect(dcApiCookie).to.be.undefined;
  });

  it("Expires the DC API Token and appears anonymous when an expired token is present", async () => {
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
    const body = JSON.parse(result.body);

    expect(result.statusCode).to.eq(200);
    expect(body).to.contain({
      iss: process.env.DC_API_ENDPOINT,
      isLoggedIn: false,
    });
    expect(body).not.to.contain({ sub: "user123" });

    const dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );
    expect(dcApiCookie.Expires).to.eq("Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("Issues an anonymous API token if no token is present", async () => {
    const event = helpers.mockEvent("GET", "/auth/whoami").render();
    const result = await getAuthWhoamiHandler.handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).to.eq(200);
    expect(body).to.contain({
      iss: process.env.DC_API_ENDPOINT,
      isLoggedIn: false,
    });
    expect(body).not.to.contain({ sub: "user123" });
  });
});
