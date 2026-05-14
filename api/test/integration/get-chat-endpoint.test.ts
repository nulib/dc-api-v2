import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";

describe("GET /chat-endpoint", () => {
  beforeEach(() => {
    setupEnv({ PROVIDER_CAPABILITIES: '{"magic":[],"nusso":["chat"]}' });
  });

  afterEach(() => {
    teardownEnv();
  });

  it("returns the websocket URI and token to a logged in user", async () => {
    const token = await new ApiToken()
      .user({ sub: "abc123" })
      .provider("nusso")
      .sign();

    const req = buildRequest("GET", "/chat/endpoint", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const response = await result.json();
    expect(response.endpoint).toEqual("wss://thisisafakewebsocketapiurl");
    // The returned auth token is re-signed, so just verify the endpoint
    expect(typeof response.auth).toEqual("string");
  });
});
