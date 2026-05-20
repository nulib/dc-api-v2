import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";

describe("OPTIONS handler", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("sends the correct CORS headers", async () => {
    const req = buildRequest("OPTIONS", "/auth/whoami", {
      headers: {
        origin: "https://dc.library.northwestern.edu/origin-test-path",
      },
    });
    const response = await sendRequest(req);

    expect(response.headers.get("access-control-allow-origin")).toEqual(
      "https://dc.library.northwestern.edu/origin-test-path",
    );

    const allowHeaders =
      response.headers.get("access-control-allow-headers") ?? "";
    expect(allowHeaders).toContain("Content-Type");
  });
});
