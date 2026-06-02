import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "bun:test";
import { setupServer } from "msw/node";
import { transformSearchResult } from "../../../../src/api/response/transformer.ts";
import { Paginator } from "../../../../src/api/pagination.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
} from "../../../test-helpers/index.ts";

describe("Response transformer", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("collapse responses", () => {
    let requestBody: Record<string, unknown>;
    let response: { status: number; body: string };

    beforeEach(() => {
      response = {
        status: 200,
        body: testFixture("mocks/collapse-search.json"),
      };

      requestBody = {
        query: {
          bool: {
            must: [
              { term: { "annotations.type": "transcription" } },
              { match_phrase: { "annotations.content": "coffee" } },
            ],
          },
        },
        size: 1,
        collapse: {
          field: "work_id",
          inner_hits: {
            name: "matching_filesets",
            size: 50,
            sort: [{ _score: "desc" }],
          },
        },
      };
    });

    it("transforms a `collapse` response to opensearch format", async () => {
      const pager = new Paginator(
        "http://dcapi.library.northwestern.edu/v2/",
        "search",
        ["file-sets"],
        requestBody,
        "opensearch",
        {},
      );

      const result = await transformSearchResult(response, pager);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toEqual(4);
      expect("version" in body.info).toBe(true);
      expect("pagination" in body).toBe(true);
      expect(body.pagination.collapsed_by).toEqual({
        field: "work_id",
        total_hits: 4,
      });
      expect(body.pagination.total_hits).toEqual(7);
      expect(body.pagination.total_pages).toEqual(4);
    });

    it("transforms a `collapse` response to iiif format", async () => {
      const pager = new Paginator(
        "http://dcapi.library.northwestern.edu/v2/",
        "search",
        ["file-sets"],
        requestBody,
        "iiif",
        {
          queryStringParameters: {
            collectionLabel: "Test Collection",
            collectionSummary: "Test Summary",
          },
        },
      );

      const result = await transformSearchResult(response, pager);
      expect(result.status).toEqual(200);

      const body = await result.json();

      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toEqual(5);
      for (let i = 0; i <= 3; i++) {
        const item = body.items[i];
        expect("homepage" in item).toBe(true);
        expect("label" in item).toBe(true);
        expect("summary" in item).toBe(true);
        expect("thumbnail" in item).toBe(true);
        expect("type" in item).toBe(true);
        expect(item.type).toEqual("Manifest");
      }

      const item = body.items[4];
      expect("id" in item).toBe(true);
      expect("type" in item).toBe(true);
      expect(item.type).toEqual("Collection");
      expect(item.label?.none?.[0]).toEqual("Next page");
    });
  });
});
