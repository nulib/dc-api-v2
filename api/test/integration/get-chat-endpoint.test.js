"use strict";

const chai = require("chai");
const expect = chai.expect;

const getChatEndpointHandler = requireSource("handlers/get-chat-endpoint");
const ApiToken = requireSource("api/api-token");

describe("GET /chat-endpoint", function () {
  helpers.saveEnvironment();

  it("returns the websocket URI and token to a logged in user", async () => {
    const token = new ApiToken().user({ uid: "abc123" }).sign();
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
