import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  documentBody,
  transform,
} from "../../../../src/api/response/opensearch/index.ts";
import { Paginator } from "../../../../src/api/pagination.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
} from "../../../test-helpers/index.ts";

describe("OpenSearch response transformer", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  let pager: Paginator;

  beforeEach(() => {
    pager = new Paginator(
      "http://dcapi.library.northwestern.edu/v2/",
      "search",
      ["works"],
      { query: { match_all: {} } },
      "opensearch",
      {},
    );
  });

  it("transforms a doc response", async () => {
    const response = {
      status: 200,
      body: testFixture("mocks/work-1234.json"),
    };
    const result = await transform(response, { pager });
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(typeof body.data === "object" && !Array.isArray(body.data)).toBe(
      true,
    );
    expect("version" in body.info).toBe(true);
    expect(!("pagination" in body)).toBe(true);
  });

  it("transforms a search response", async () => {
    const search = JSON.parse(testFixture("mocks/search.json"));
    for (const hit of search.hits.hits) {
      hit._source.ai_provenance_exports = { premis: { events: [] } };
      hit._source.ai_provenance = { title: { origin: "ai_generated" } };
    }
    const response = {
      status: 200,
      body: JSON.stringify(search),
    };
    const result = await transform(response, { pager });
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const document of body.data) {
      expect(document).not.toHaveProperty("ai_provenance_exports");
      expect(document).not.toHaveProperty("ai_provenance");
    }
    expect("version" in body.info).toBe(true);
    expect("pagination" in body).toBe(true);
    const pagination = body.pagination as Record<string, unknown>;
    for (const key of [
      "query_url",
      "current_page",
      "limit",
      "next_url",
      "offset",
      "total_hits",
      "total_pages",
    ]) {
      expect(key in pagination).toBe(true);
    }
  });

  it("omits AI provenance from documents and annotations without changing the source", () => {
    const source = {
      id: "1234",
      ai_provenance: { title: { origin: "ai_generated" } },
      ai_provenance_exports: { premis: { events: [] }, c2pa: {} },
      annotations: [
        {
          id: "annotation-1",
          content: "Transcription",
          ai_provenance: { content: { diff: "Large diff" } },
          ai_provenance_exports: { premis: { events: [] } },
        },
        { id: "annotation-2", content: "Other transcription" },
      ],
    };
    const original = structuredClone(source);

    expect(JSON.parse(documentBody(source)).data).toEqual({
      id: "1234",
      annotations: [
        { id: "annotation-1", content: "Transcription" },
        { id: "annotation-2", content: "Other transcription" },
      ],
    });
    expect(source).toEqual(original);
  });

  it("transforms an error response", async () => {
    const response = {
      status: 404,
      body: testFixture("mocks/missing-index.json"),
    };
    const result = await transform(response, { pager });
    expect(result.status).toEqual(404);

    const body = await result.json();
    expect(body.status).toEqual(404);
    expect(typeof body.error === "string").toBe(true);
  });
});
