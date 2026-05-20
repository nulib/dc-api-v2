import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";

describe("Provider status check", () => {
  beforeEach(() => {
    setupEnv({ PROVIDER_CAPABILITIES: '{"magic":[],"nusso":["chat"]}' });
  });

  afterEach(() => {
    teardownEnv();
  });

  it("should return enabled=true for enabled provider", async () => {
    const req = buildRequest("GET", "/capabilities/nusso/chat", {
      pathParams: { provider: "nusso", feature: "chat" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const body = await result.json();
    expect(body.enabled).toEqual(true);
  });

  it("should return enabled=false for disabled provider", async () => {
    const req = buildRequest("GET", "/capabilities/magic/chat", {
      pathParams: { provider: "magic", feature: "chat" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    const body = await result.json();
    expect(body.enabled).toEqual(false);
  });

  it("should return not found for unknown provider", async () => {
    const req = buildRequest("GET", "/capabilities/google/chat", {
      pathParams: { provider: "google", feature: "chat" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(404);
    const body = await result.json();
    expect(body.error).toEqual("Provider 'google' not found");
  });
});
