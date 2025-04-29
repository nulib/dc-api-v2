"use strict";

const chai = require("chai");
const expect = chai.expect;
const { mockClient } = require("aws-sdk-client-mock");
const { SESClient, SendTemplatedEmailCommand } = require("@aws-sdk/client-ses");

const { handler } = requireSource("handlers/get-auth-stage");
const { createMagicToken } = requireSource("handlers/auth/magic-link");

describe("Magic link login", () => {
  helpers.saveEnvironment();
  const sesMock = mockClient(SESClient);

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "TEST_SECRET";
    process.env.DC_API_ENDPOINT = "https://api.example.edu/";
    process.env.DC_URL = "https://dc.example.edu/";
    process.env.MAGIC_LINK_EMAIL_TEMPLATE = "magic-link-template";
    process.env.REPOSITORY_EMAIL = "email@example.edu";
    sesMock.reset();
  });

  it("should return 200 and send a magic link email", async () => {
    sesMock.on(SendTemplatedEmailCommand).resolves({});
    const event = helpers
      .mockEvent("GET", "/auth/login/magic")
      .pathParams({ provider: "magic", stage: "login" })
      .queryParams({
        email: "user@example.edu",
        goto: "https://dc.example.edu/items/1234",
      })
      .render();
    const response = await handler(event, {
      injections: { sesClient: new SESClient({}) },
    });
    expect(sesMock.calls()).to.have.length(1);
    expect(response.statusCode).to.equal(200);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("message", "Magic link sent");
    expect(body).to.have.property("email", "user@example.edu");
  });

  it("should return 400 if email is not provided", async () => {
    const event = helpers
      .mockEvent("GET", "/auth/login/magic")
      .pathParams({ provider: "magic", stage: "login" })
      .render();
    const response = await handler(event, {
      injections: { sesClient: new SESClient({}) },
    });
    expect(response.statusCode).to.equal(400);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("error", "Email is required");
  });
});

describe("Magic link callback", () => {
  helpers.saveEnvironment();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "TEST_SECRET";
  });

  it("should issue a 302 redirect to the goto URL", async () => {
    const { token } = createMagicToken(
      "user@example.edu",
      "https://dc.example.edu/items/1234"
    );

    const event = helpers
      .mockEvent("GET", "/auth/callback/magic")
      .pathParams({ provider: "magic", stage: "callback" })
      .queryParams({ token })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(302);
    expect(response.headers.location).to.equal(
      "https://dc.example.edu/items/1234"
    );
  });

  it("should return 400 if token is not provided", async () => {
    const event = helpers
      .mockEvent("GET", "/auth/callback/magic")
      .pathParams({ provider: "magic", stage: "callback" })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(400);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("error", "Missing token");
  });

  it("should return 401 if token is invalid", async () => {
    const event = helpers
      .mockEvent("GET", "/auth/callback/magic")
      .pathParams({ provider: "magic", stage: "callback" })
      .queryParams({ token: "invalid-token" })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(401);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("error", "Invalid token signature");
  });

  it("should return 401 if token is expired", async () => {
    const { token } = createMagicToken(
      "user@example.edu",
      "https://dc.example.edu/items/1234",
      Date.now() - 1000 * 60 * 60
    );
    const event = helpers
      .mockEvent("GET", "/auth/callback/magic")
      .pathParams({ provider: "magic", stage: "callback" })
      .queryParams({ token })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(401);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("error", "Token expired");
  });
});
