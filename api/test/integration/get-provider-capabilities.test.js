"use strict";

const chai = require("chai");
const expect = chai.expect;

const { handler } = requireSource("handlers/get-provider-capabilities");

describe("Provider status check", () => {
  helpers.saveEnvironment();

  beforeEach(() => {
    process.env.PROVIDER_CAPABILITIES = '{"magic":[],"nusso":["chat"]}';
  });

  it("should return enabled=true for enabled provider", async () => {
    const event = helpers
      .mockEvent("GET", "/status/nusso/chat")
      .pathParams({ provider: "nusso", feature: "chat" })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(200);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("enabled", true);
  });

  it("should return enabled=false for disabled provider", async () => {
    const event = helpers
      .mockEvent("GET", "/status/magic/chat")
      .pathParams({ provider: "magic", feature: "chat" })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(200);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("enabled", false);
  });

  it("should return not found for unknown provider", async () => {
    const event = helpers
      .mockEvent("GET", "/status/google/chat")
      .pathParams({ provider: "google", feature: "chat" })
      .render();
    const response = await handler(event);
    expect(response.statusCode).to.equal(404);
    const body = JSON.parse(response.body);
    expect(body).to.have.property("error", "Provider 'google' not found");
  });
});
