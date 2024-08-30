"use strict";

const chai = require("chai");
const expect = chai.expect;
const jwt = require("jsonwebtoken");

const getAuthTokenHandler = requireSource("handlers/get-auth-token");

// Utility functions to calculate the number of seconds or milliseconds from the epoch plus
// an offset in seconds, but with one-second resolution
const fromNowSeconds = (seconds) =>
  Math.floor((new Date().getTime() + seconds * 1000) / 1000);

describe("auth token", function () {
  helpers.saveEnvironment();
  let payload;

  beforeEach(() => {
    payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
    };
  });

  it("works with anonymous users", async () => {
    const event = helpers.mockEvent("GET", "/auth/token").render();

    const expectedExpiration = fromNowSeconds(86400);
    const result = await getAuthTokenHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    const body = JSON.parse(result.body);

    // Built-in Date will be in millis and our expiration is in seconds
    expect(Date.parse(body.expires)).to.be.within(
      (expectedExpiration - 1) * 1000,
      (expectedExpiration + 1) * 1000
    );

    const resultToken = jwt.verify(body.token, process.env.API_TOKEN_SECRET);
    expect(resultToken.exp).to.be.within(
      expectedExpiration - 1,
      expectedExpiration + 1
    );
    expect(resultToken.isLoggedIn).to.eq(false);
  });

  it("returns a token with a default ttl of 1 day", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);
    const event = helpers
      .mockEvent("GET", "/auth/token")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const expectedExpiration = fromNowSeconds(86400);
    const result = await getAuthTokenHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    const body = JSON.parse(result.body);

    // Built-in Date will be in millis and our expiration is in seconds
    expect(Date.parse(body.expires)).to.be.within(
      (expectedExpiration - 1) * 1000,
      (expectedExpiration + 1) * 1000
    );

    const resultToken = jwt.verify(body.token, process.env.API_TOKEN_SECRET);
    expect(resultToken.exp).to.be.within(
      expectedExpiration - 1,
      expectedExpiration + 1
    );
    expect(resultToken.name).to.eq("Some One");
  });

  it("returns a token with the requested ttl", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);
    const ttl = 3600 * 18; // 18 hours
    const event = helpers
      .mockEvent("GET", "/auth/token")
      .queryParams({ ttl: ttl.toString() })
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const expectedExpiration = fromNowSeconds(ttl);
    const result = await getAuthTokenHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    const body = JSON.parse(result.body);

    // Built-in Date will be in millis and our expiration is in seconds
    expect(Date.parse(body.expires)).to.be.within(
      (expectedExpiration - 1) * 1000,
      (expectedExpiration + 1) * 1000
    );

    const resultToken = jwt.verify(body.token, process.env.API_TOKEN_SECRET);
    expect(resultToken.exp).to.be.within(
      expectedExpiration - 1,
      expectedExpiration + 1
    );
    expect(resultToken.name).to.eq("Some One");
  });

  it("rejects a request with a non-numeric ttl", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);
    const event = helpers
      .mockEvent("GET", "/auth/token")
      .queryParams({ ttl: "blargh" })
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();
    const result = await getAuthTokenHandler.handler(event);
    expect(result.statusCode).to.eq(400);
    expect(result.body).to.eq("'blargh' is not a valid value for ttl");
  });

  it("rejects a request with a ttl that's too high", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);
    const event = helpers
      .mockEvent("GET", "/auth/token")
      .queryParams({ ttl: "864000" })
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();
    const result = await getAuthTokenHandler.handler(event);
    expect(result.statusCode).to.eq(400);
    expect(result.body).to.eq("ttl cannot exceed 604800 seconds");
  });
});
