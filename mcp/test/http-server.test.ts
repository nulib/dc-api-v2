/**
 * Tests for the local Express entry point (apps/mcp/handlers/main.ts)
 *
 * Starts the real Express app on an ephemeral port and exercises the HTTP
 * bridge (request conversion, response writing, header validation) end to
 * end. Only methods that never call the Digital Collections API are used,
 * so MSW HAR fixtures are not involved; MSW's unhandled-request guard lets
 * loopback traffic through (see test/support/setup.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "node:http";

import { createApp } from "../apps/mcp/handlers/main.js";
import { makeModernRequest, parseJsonRpcBody } from "./support/lambda-event.js";

let httpServer: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer = createApp().listen(0, () => resolve());
  });
  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error(`Unexpected server address: ${address}`);
  }
  baseUrl = `http://localhost:${address.port}/mcp`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
});

const post = async (
  headers: Record<string, string>,
  body: unknown
): Promise<{ status: number; message: any }> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { status: response.status, message: parseJsonRpcBody(await response.text()) };
};

describe("Express HTTP entry point", () => {
  it("should answer server/discover", async () => {
    const { headers, body } = makeModernRequest("server/discover");
    const { status, message } = await post(headers, body);

    expect(status).toBe(200);
    expect(message.result.supportedVersions).toContain("2026-07-28");
    expect(
      message.result._meta?.["io.modelcontextprotocol/serverInfo"]?.name
    ).toBe("dc-api-mcp");
  });

  it("should serve tools/list with cache hints", async () => {
    const { headers, body } = makeModernRequest("tools/list");
    const { status, message } = await post(headers, body);

    expect(status).toBe(200);
    expect(message.result.tools.length).toBeGreaterThan(0);
    expect(message.result.ttlMs).toBe(3_600_000);
    expect(message.result.cacheScope).toBe("public");
  });

  it("should reject a modern request missing the Mcp-Method header", async () => {
    const { headers, body } = makeModernRequest("tools/list");
    delete headers["mcp-method"];
    const { status, message } = await post(headers, body);

    expect(status).toBe(400);
    expect(message.error.code).toBe(-32020);
  });

  it("should still serve 2025-era initialize requests", async () => {
    const { status, message } = await post(
      {
        "content-type": "application/json",
        accept: "application/json, text/event-stream"
      },
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "legacy-test-client", version: "1.0.0" }
        }
      }
    );

    expect(status).toBe(200);
    expect(message.result.protocolVersion).toBe("2025-06-18");
    expect(message.result.serverInfo.name).toBe("dc-api-mcp");
  });

  it("should preserve query-less request URLs and CORS on preflight", async () => {
    const response = await fetch(baseUrl, {
      method: "OPTIONS",
      headers: {
        origin: "https://example.org",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,mcp-method"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
