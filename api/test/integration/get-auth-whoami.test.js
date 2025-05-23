"use strict";

const chai = require("chai");
const expect = chai.expect;
const jwt = require("jsonwebtoken");

const getAuthWhoamiHandler = requireSource("handlers/get-auth-whoami");

describe("auth whoami", function () {
  helpers.saveEnvironment();

  let payload;

  beforeEach(() => {
    payload = {
      iss: "https://thisisafakeapiurl",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
    };
  });

  it("returns user info", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const event = helpers
      .mockEvent("GET", "/auth/whoami")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    const response = JSON.parse(result.body);
    expect(response).to.contain({ name: "Some One" });
    expect(response).to.have.property("scopes");
  });

  it("Doesn't set a new cookie if the token is not updated", async () => {
    const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    let event = helpers
      .mockEvent("GET", "/auth/whoami")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
      })
      .render();

    let result = await getAuthWhoamiHandler.handler(event);
    let dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );
    expect(dcApiCookie).to.have.property("value");

    event = helpers
      .mockEvent("GET", "/auth/whoami")
      .headers({
        Cookie: `${process.env.API_TOKEN_NAME}=${dcApiCookie.value};`,
      })
      .render();
    result = await getAuthWhoamiHandler.handler(event);
    dcApiCookie = helpers.cookieValue(
      result.cookies,
      process.env.API_TOKEN_NAME
    );
    expect(dcApiCookie).to.be.undefined;
  });

  it("Expires the DC API Token and appears anonymous when an expired token is present", async () => {
    payload.exp = Math.floor(Number(new Date()) / 1000);
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
