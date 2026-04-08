/**
 * Unit tests for pure functions and utilities
 *
 * These tests don't require HTTP mocking or MCP client/server setup.
 * They test isolated business logic directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  summarizeResults,
  buildIIIFSearchUrl,
  handleToolError
} from "../apps/mcp/common/functions.js";
import { buildQuery } from "../apps/mcp/common/works.js";
import { isEnum } from "../apps/mcp/common/schemas.js";
import * as z from "zod/v4";
import { McpError } from "@modelcontextprotocol/sdk/types";

describe("Pure Function Unit Tests", () => {
  describe("summarizeResults", () => {
    it("should format result summary correctly", () => {
      const results = {
        pagination: {
          total_hits: 42,
          total_pages: 5,
          current_page: 2,
          limit: 10
        },
        info: {
          name: "test",
          description: "test",
          version: "1.0.0"
        }
      };

      const summary = summarizeResults(results as any);

      expect(summary).toContain("42 results");
      expect(summary).toContain("5 pages");
      expect(summary).toContain("current page is 2");
      expect(summary).toContain("10 results per page");
    });

    it("should handle singular result correctly", () => {
      const results = {
        pagination: {
          total_hits: 1,
          total_pages: 1,
          current_page: 1,
          limit: 1
        },
        info: {
          name: "test",
          description: "test",
          version: "1.0.0"
        }
      };

      const summary = summarizeResults(results as any);

      expect(summary).toContain("1 result");
      expect(summary).toContain("1 page");
      expect(summary).toContain("1 result per page");
      expect(summary).not.toContain("results");
      expect(summary).not.toContain("pages");
    });
  });

  describe("buildIIIFSearchUrl", () => {
    it("should construct valid IIIF search URL", () => {
      const queryObject = {
        query: {
          match: {
            all_text: "test query"
          }
        },
        size: 10
      };

      const options = {
        page: 1,
        size: 10
      };

      const url = buildIIIFSearchUrl(queryObject, options);

      expect(url).toContain("/search/works");
      expect(url).toContain("searchToken=");
      expect(url).toContain("page=1");
      expect(url).toContain("size=10");
      expect(url).toContain("as=iiif");
    });

    it("should encode search token in URL", () => {
      const queryObject = {
        query: {
          match: {
            title: "Chicago"
          }
        },
        size: 5
      };

      const url = buildIIIFSearchUrl(queryObject, { page: 2, size: 5 });

      expect(url).toMatch(/searchToken=[A-Za-z0-9_-]+/);
      expect(url).toContain("page=2");
      expect(url).toContain("size=5");
    });
  });

  describe("buildQuery", () => {
    it("should build query for natural language search", () => {
      const input = {
        query: "photographs of Chicago",
        max_results: 10,
        page: 2,
        public_only: true
      };

      const { query, options } = buildQuery(input);

      expect(query.query).toBeDefined();
      expect(query.query?.neural).toBeDefined();
      expect(query.query?.neural?.embedding?.query_text).toBe(
        "photographs of Chicago"
      );
      expect(options.size).toBe(10);
      expect(options.page).toBe(2);
      expect(options.visibility).toStrictEqual("public");
    });

    it("should build query for field-based search", () => {
      const input = {
        fields: {
          work_type: "Image",
          subject: "Architecture"
        },
        max_results: 5,
        page: 1,
        public_only: true
      };

      const { query, options } = buildQuery(input);

      expect(query.query).toBeDefined();
      expect(query.query.bool).toBeDefined();
      expect(query.query.bool.should.length).toBe(2);
    });

    it("should combine natural language and field filters", () => {
      const input = {
        query: "landscape",
        fields: {
          work_type: "Image",
          technique: "Photograph"
        },
        max_results: 10,
        page: 1,
        public_only: true
      };

      const { query } = buildQuery(input);
      expect(query.query.neural).toBeDefined();
      expect(query.query.neural.embedding).toBeDefined();
      expect(query.query.neural.embedding.filter).toBeDefined();
      expect(query.query.neural.embedding.filter.bool?.should?.length).toBe(2);
    });

    it("should apply public_only filter when true", () => {
      const input = {
        query: "test",
        max_results: 10,
        page: 1,
        public_only: true
      };

      const { options } = buildQuery(input);
      expect(options.visibility).toStrictEqual("public");
    });

    it("should not filter by visibility when public_only is false", () => {
      const input = {
        query: "test",
        max_results: 10,
        page: 1,
        public_only: false
      };

      const { options } = buildQuery(input);
      expect(options.visibility).toBe("institution,public");
    });

    it("should include aggregations in query", () => {
      const input = {
        query: "test",
        max_results: 10,
        page: 1,
        public_only: true
      };

      const { query } = buildQuery(input);

      expect(query.aggs).toBeDefined();
      expect(query.aggs.collection).toBeDefined();
      expect(query.aggs.work_type).toBeDefined();
      expect(query.aggs.visibility).toBeDefined();
    });

    it("should handle empty search (list all)", () => {
      const input = {
        max_results: 10,
        page: 1,
        public_only: true
      };

      const { query, options } = buildQuery(input);

      expect(options.size).toBe(10);
    });
  });

  describe("isEnum", () => {
    it("should detect enum types", () => {
      const enumSchema = z.enum(["a", "b", "c"]);
      expect(isEnum(enumSchema)).toBe(true);
    });

    it("should detect optional enum types", () => {
      const optionalEnumSchema = z.enum(["a", "b", "c"]).optional();
      expect(isEnum(optionalEnumSchema)).toBe(true);
    });

    it("should return false for non-enum types", () => {
      const stringSchema = z.string();
      expect(isEnum(stringSchema)).toBe(false);
    });

    it("should return false for number types", () => {
      const numberSchema = z.number();
      expect(isEnum(numberSchema)).toBe(false);
    });
  });

  describe("handleToolError", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should throw McpError with InvalidParams for ZodError", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      expect(() => {
        try {
          schema.parse({ name: "Alice", age: "not a number" });
        } catch (error) {
          handleToolError(error);
        }
      }).toThrow(McpError);
      expect(console.error).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            "Invalid input: expected number, received string"
          )
        })
      );
    });

    it("should throw McpError with InternalError for generic errors", () => {
      expect(() => {
        try {
          throw new Error("Generic Error");
        } catch (error) {
          handleToolError(error);
        }
      }).toThrow(McpError);

      expect(console.error).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Generic Error")
        })
      );
    });
  });
});
