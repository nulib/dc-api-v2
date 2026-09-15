import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";

describe("MCP server card", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("returns the server card", async () => {
    const req = buildRequest("GET", "/mcp/server-card");
    const response = await sendRequest(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("$schema");
    expect(body).toHaveProperty("name", "io.github.nulib/dc-api");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("description");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("websiteUrl");
    expect(body).toHaveProperty("repository");
    expect(body).toHaveProperty("remotes");
    expect(Array.isArray(body.remotes)).toBe(true);
  });
});
