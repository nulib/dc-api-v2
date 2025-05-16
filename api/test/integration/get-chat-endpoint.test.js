"use strict";

const chai = require("chai");
const expect = chai.expect;

const getChatEndpointHandler = requireSource("handlers/get-chat-endpoint");
const ApiToken = requireSource("api/api-token");

describe("GET /chat-endpoint", function () {
  helpers.saveEnvironment();
  beforeEach(() => {
    process.env.PROVIDER_CAPABILITIES = '{"magic":[],"nusso":["chat"]}';
  });

  it("returns the websocket URI and token to a logged in user", async () => {
    let token = new ApiToken().user({ sub: "abc123" }).provider("nusso");
    token = token.sign();
    const event = helpers
      .mockEvent("GET", "/chat-endpoint")
      .headers({
        Authorization: `Bearer ${token}`,
      })
      .render();

    const result = await getChatEndpointHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    const response = JSON.parse(result.body);
    expect(response).to.contain({
      endpoint: "wss://thisisafakewebsocketapiurl",
      auth: token,
    });
  });
});
