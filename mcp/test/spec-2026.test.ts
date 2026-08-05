/**
 * Tests for MCP specification revision 2026-07-28 behaviors
 *
 * Protocol-level tests use the MCP client with in-memory transport (like
 * integration.test.ts). HTTP-level tests exercise the real Lambda handler
 * in-process with synthetic API Gateway events, covering SEP-2243 standard
 * header enforcement and legacy-client fallback. Only methods that never
 * call the Digital Collections API are used over HTTP, so MSW replay
 * fixtures are not involved.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import { createServer } from "../apps/mcp/server.js";
import { handler } from "../apps/mcp/handlers/lambda.js";
import { DC_RESOURCE_ORIGINS } from "../apps/mcp/config.js";
import {
  createTestContext,
  type McpTestContext
} from "./support/mcp-harness.js";
import {
  makeEvent,
  makeModernRequest,
  parseJsonRpcBody
} from "./support/lambda-event.js";

const CLOVER_RESOURCE_URI = "ui://clover-viewer/mcp-app.html";

describe("MCP 2026-07-28 protocol behaviors", () => {
  let context: McpTestContext;

  beforeEach(async () => {
    context = await createTestContext(createServer);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe("cache hints (SEP-2549)", () => {
    it("should advertise ttlMs and cacheScope on tools/list", async () => {
      const tools = await context.client.listTools();
      expect(tools.ttlMs).toBe(3_600_000);
      expect(tools.cacheScope).toBe("public");
    });

    it("should advertise ttlMs and cacheScope on resources/list", async () => {
      const resources = await context.client.listResources();
      expect(resources.ttlMs).toBe(3_600_000);
      expect(resources.cacheScope).toBe("public");
    });

    it("should advertise ttlMs and cacheScope on resources/read", async () => {
      const resource = await context.client.readResource({
        uri: CLOVER_RESOURCE_URI
      });
      expect(resource.ttlMs).toBe(3_600_000);
      expect(resource.cacheScope).toBe("public");
    });
  });

  describe("UI resource (MCP Apps)", () => {
    it("should serve the Clover viewer resource with CSP metadata", async () => {
      const resource = await context.client.readResource({
        uri: CLOVER_RESOURCE_URI
      });

      expect(resource.contents).toHaveLength(1);
      const content = resource.contents[0] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(content.uri).toBe(CLOVER_RESOURCE_URI);
      expect(content.mimeType).toBe("text/html;profile=mcp-app");
      expect(content.text).toContain("<html");
      expect(content._meta?.ui?.csp?.resourceDomains).toEqual(
        DC_RESOURCE_ORIGINS
      );
      expect(content._meta?.ui?.csp?.connectDomains).toEqual(
        DC_RESOURCE_ORIGINS
      );
    });
  });
});

describe("MCP 2026-07-28 Streamable HTTP (Lambda handler)", () => {
  const lambdaContext = {} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  describe("server/discover", () => {
    it("should respond to a modern discover request", async () => {
      const { headers, body } = makeModernRequest("server/discover");
      const response = (await handler(
        makeEvent({ headers, body }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(200);
      const message = parseJsonRpcBody(response.body);
      expect(message.result).toBeDefined();
      expect(message.error).toBeUndefined();
      expect(message.result.supportedVersions).toContain("2026-07-28");
      expect(
        message.result._meta?.["io.modelcontextprotocol/serverInfo"]?.name
      ).toBe("dc-api-mcp");
    });
  });

  describe("standard header enforcement (SEP-2243)", () => {
    it("should serve tools/list with correct standard headers", async () => {
      const { headers, body } = makeModernRequest("tools/list");
      const response = (await handler(
        makeEvent({ headers, body }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(200);
      const message = parseJsonRpcBody(response.body);
      expect(message.result.tools.length).toBeGreaterThan(0);
      expect(message.result.ttlMs).toBe(3_600_000);
      expect(message.result.cacheScope).toBe("public");
    });

    it("should reject a modern request missing the Mcp-Method header", async () => {
      const { headers, body } = makeModernRequest("tools/list");
      delete headers["mcp-method"];
      const response = (await handler(
        makeEvent({ headers, body }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(400);
      const message = parseJsonRpcBody(response.body);
      expect(message.error.code).toBe(-32020);
    });

    it("should reject a modern request with a mismatched Mcp-Method header", async () => {
      const { headers, body } = makeModernRequest("tools/list");
      headers["mcp-method"] = "resources/list";
      const response = (await handler(
        makeEvent({ headers, body }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(400);
      const message = parseJsonRpcBody(response.body);
      expect(message.error.code).toBe(-32020);
    });

    it("should advertise the standard headers in CORS preflight responses", async () => {
      const response = (await handler(
        makeEvent({ method: "OPTIONS" }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(204);
      const allowHeaders = response.headers["Access-Control-Allow-Headers"];
      expect(allowHeaders).toContain("Mcp-Method");
      expect(allowHeaders).toContain("Mcp-Name");
      expect(allowHeaders).toContain("MCP-Protocol-Version");
      expect(allowHeaders).not.toContain("Mcp-Session-Id");
    });
  });

  describe("legacy client fallback", () => {
    it("should still serve 2025-era initialize requests", async () => {
      const response = (await handler(
        makeEvent({
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream"
          },
          body: {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "legacy-test-client", version: "1.0.0" }
            }
          }
        }),
        lambdaContext
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.statusCode).toBe(200);
      const message = parseJsonRpcBody(response.body);
      expect(message.result.protocolVersion).toBe("2025-06-18");
      expect(message.result.serverInfo.name).toBe("dc-api-mcp");
    });
  });
});
