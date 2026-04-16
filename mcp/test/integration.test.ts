/**
 * Integration tests for MCP server tools
 *
 * These tests use the MCP client with in-memory transport to test the full
 * request/response cycle, and use MSW to record/replay HTTP requests to the
 * Digital Collections API.
 *
 * To record new fixtures:
 *   npm run test:record
 *
 * To replay from fixtures (default):
 *   npm test
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { createServer } from "../apps/mcp/server.js";
import {
  createTestContext,
  type McpTestContext
} from "./support/mcp-harness.js";

const KNOWN_COLLECTION_ID = "18ec4c6b-192a-4ab8-9903-ea0f393c35f7";
const KNOWN_WORK_ID = "6464c86a-29e0-4aeb-ac5c-8e1c9bb0dfc2";

describe("MCP Server Integration Tests", () => {
  let context: McpTestContext;

  beforeEach(async () => {
    context = await createTestContext(createServer);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe("search tool", () => {
    it("should search for works with a natural language query", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          query: "photographs of Chicago",
          max_results: 5,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const response = JSON.parse((result.content[0] as any).text);

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("pagination");
      expect(response).toHaveProperty("aggregations");
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.pagination.limit).toBe(5);
      expect(response.pagination.current_page).toBe(1);
    });

    it("should search for works with field-based search", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          fields: {
            work_type: "Image",
            subject: "Architecture"
          },
          max_results: 10,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse((result.content[0] as any).text);

      expect(response.data).toBeDefined();
      expect(response.pagination.limit).toBe(10);
    });

    it("should search with combined natural language and field filters", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          query: "landscape",
          fields: {
            work_type: "Image"
          },
          max_results: 5,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      const structuredContent: any = result.structuredContent;
      expect(structuredContent.data).toBeDefined();
      expect(Array.isArray(structuredContent.data)).toBe(true);
    });

    it("should perform an empty search to get all works", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          max_results: 5,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse((result.content[0] as any).text);

      expect(response.data).toBeDefined();
      expect(response.pagination.total_hits).toBeGreaterThan(0);
      expect(response.aggregations).toBeDefined();
    });

    it("should include aggregations in search results", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          query: "Northwestern",
          max_results: 1,
          public_only: true
        }
      });

      const response = JSON.parse((result.content[0] as any).text);

      expect(response.aggregations).toBeDefined();
      expect(response.aggregations.collection).toBeDefined();
      expect(response.aggregations.work_type).toBeDefined();
      expect(response.aggregations.visibility).toBeDefined();
      expect(Array.isArray(response.aggregations.collection)).toBe(true);
    });
  });

  describe("find-terms tool", () => {
    it("should return suggested terms for a given input", async () => {
      const result = await context.client.callTool({
        name: "find-terms",
        arguments: {
          text: "chicago"
        }
      });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse((result.content[0] as any).text);

      expect(response).toHaveProperty("result");
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.result.length).toBeGreaterThan(0);
      expect(response.result[0]).toHaveProperty("field");
      expect(response.result[0]).toHaveProperty("terms");
      expect(Array.isArray(response.result[0].terms)).toBe(true);
    });
  });

  describe("view-search-results tool", () => {
    it("should return a viewer for the results of a search", async () => {
      const result = await context.client.callTool({
        name: "view-search-results",
        arguments: {
          query: "photographs of Chicago",
          max_results: 5,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.structuredContent).toHaveProperty("iiifContentUrl");
      const { iiifContentUrl } = result.structuredContent as any;
      expect(iiifContentUrl).toContain("searchToken=");
      expect(iiifContentUrl).toContain("size=5");
      expect(iiifContentUrl).toContain("page=1");
      expect(iiifContentUrl).toContain("as=iiif");
    });
  });

  describe("get-work tool", () => {
    it("should retrieve a work by ID", async () => {
      // Use a known work ID from the Digital Collections
      const workId = "6464c86a-29e0-4aeb-ac5c-8e1c9bb0dfc2"; // Replace with actual ID

      const result = await context.client.callTool({
        name: "get-work",
        arguments: {
          work_id: workId
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const work = JSON.parse((result.content[0] as any).text);

      expect(work).toHaveProperty("id");
      expect(work.id).toBe(workId);
      expect(work).toHaveProperty("title");
      expect(work).toHaveProperty("work_type");
    });
  });

  describe("view-work tool", () => {
    it("should return a work viewer by ID", async () => {
      const result = await context.client.callTool({
        name: "view-work",
        arguments: {
          work_id: KNOWN_WORK_ID
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(KNOWN_WORK_ID);
      expect(result.structuredContent).toHaveProperty("iiifContentUrl");
    });
  });

  describe("view-similar-works tool", () => {
    it("should return a viewer for the results of a similarity search", async () => {
      const result = await context.client.callTool({
        name: "view-similar-works",
        arguments: {
          work_id: KNOWN_WORK_ID,
          max_results: 5,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.structuredContent).toHaveProperty("iiifContentUrl");
      const { iiifContentUrl } = result.structuredContent as any;
      expect(iiifContentUrl).toContain("searchToken=");
      expect(iiifContentUrl).toContain("size=5");
      expect(iiifContentUrl).toContain("page=1");
      expect(iiifContentUrl).toContain("as=iiif");
    });
  });

  describe("view-collection tool", () => {
    it("should return a collection viewer by ID", async () => {
      const result = await context.client.callTool({
        name: "view-collection",
        arguments: {
          collection_id: KNOWN_COLLECTION_ID
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(KNOWN_COLLECTION_ID);
      expect(result.structuredContent).toHaveProperty("iiifContentUrl");
    });
  });

  describe("list-collections tool", () => {
    it("should list collections", async () => {
      const result = await context.client.callTool({
        name: "list-collections",
        arguments: {
          max_results: 10,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse((result.content[0] as any).text);

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("pagination");
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.pagination.limit).toBe(10);
    });
  });

  describe("similarity-search tool", () => {
    it("should find similar works", async () => {
      const workId = "6464c86a-29e0-4aeb-ac5c-8e1c9bb0dfc2"; // Replace with actual ID

      const result = await context.client.callTool({
        name: "similarity-search",
        arguments: {
          work_id: workId,
          max_results: 5,
          page: 1,
          public_only: true
        }
      });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse((result.content[0] as any).text);

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("pagination");
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe("tool listing", () => {
    it("should list all available tools", async () => {
      const tools = await context.client.listTools();

      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBeGreaterThan(0);

      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain("search");
      expect(toolNames).toContain("get-work");
      expect(toolNames).toContain("list-collections");
      expect(toolNames).toContain("similarity-search");
    });

    it("should include tool descriptions", async () => {
      const tools = await context.client.listTools();

      const searchTool = tools.tools.find((t) => t.name === "search");
      expect(searchTool).toBeDefined();
      expect(searchTool?.description).toBeTruthy();
      expect(searchTool?.inputSchema).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid tool name", async () => {
      const result = await context.client.callTool({
        name: "nonexistent-tool",
        arguments: {}
      });
      expect((result.content as any)[0].text).toBe(
        "MCP error -32602: Tool nonexistent-tool not found"
      );
    });

    it("should handle invalid parameters", async () => {
      const result = await context.client.callTool({
        name: "search",
        arguments: {
          max_results: 100, // Exceeds maximum of 20
          page: 1,
          public_only: true
        }
      });
      expect((result.content as any)[0].text).toContain(
        "Input validation error: Invalid arguments for tool search"
      );
      expect((result.content as any)[0].text).toContain(
        "Too big: expected number to be <=20"
      );
    });
  });
});
