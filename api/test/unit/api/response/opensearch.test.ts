import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { transform } from "../../../../src/api/response/opensearch/index.ts";
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
    const response = {
      status: 200,
      body: testFixture("mocks/search.json"),
    };
    const result = await transform(response, { pager });
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(Array.isArray(body.data)).toBe(true);
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
