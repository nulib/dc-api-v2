import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { decodeSearchToken, Paginator } from "../../../src/api/pagination.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";

describe("Paginator", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  const requestBody = {
    query: { match_all: {} },
    size: 50,
    sort: [{ create_date: "asc" }],
    _source: ["id", "title", "collection"],
    aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
    collapse: {
      field: "collection.id",
      inner_hits: { name: "top_collection_hits", size: 1 },
    },
  };

  let pager: Paginator;

  beforeEach(() => {
    pager = new Paginator(
      "https://api.test.library.northwestern.edu/api/v2/",
      "search",
      ["works"],
      { ...requestBody },
      "opensearch",
      {},
    );
  });

  it("produces page 1 pagination", async () => {
    const result = await pager.pageInfo(1275);
    expect(result.current_page).toEqual(1);
    expect(result.offset).toEqual(0);
    expect(result.limit).toEqual(50);
    expect(result.total_hits).toEqual(1275);
    expect(result.total_pages).toEqual(26);
    expect(result.prev_url).toEqual(undefined);

    const url = new URL(result.next_url as string);
    expect(url.host).toEqual("api.test.library.northwestern.edu");
    expect(url.pathname).toEqual("/api/v2/search");
    expect(url.searchParams.get("page")).toEqual("2");
  });

  it("produces additional page pagination", async () => {
    pager.body.from = 100;
    const result = await pager.pageInfo(1275);
    expect(result.current_page).toEqual(3);
    expect(new URL(result.prev_url as string).searchParams.get("page")).toEqual(
      "2",
    );
    expect(new URL(result.next_url as string).searchParams.get("page")).toEqual(
      "4",
    );
  });

  it("produces last page pagination", async () => {
    pager.body.from = 1270;
    const result = await pager.pageInfo(1275);
    expect(result.next_url).toEqual(undefined);
  });

  it("produces a usable token", async () => {
    pager.body.from = 100;
    const result = await pager.pageInfo(1275);
    const token = new URL(result.query_url as string).searchParams.get(
      "searchToken",
    );
    const rehydrated = await decodeSearchToken(token!);

    expect(Array.isArray((rehydrated as { models: string[] }).models)).toBe(
      true,
    );
    expect((rehydrated as { models: string[] }).models.includes("works")).toBe(
      true,
    );
    const body = (rehydrated as { body: Record<string, unknown> }).body;
    for (const field of [
      "aggs",
      "collapse",
      "query",
      "size",
      "sort",
      "_source",
    ]) {
      expect(body[field]).toEqual(
        (requestBody as Record<string, unknown>)[field],
      );
    }
    expect(!("from" in body)).toBe(true);
  });

  it("correctly sets the default size", async () => {
    delete pager.body.size;
    const result = await pager.pageInfo(1275);
    expect(result.limit).toEqual(10);
  });

  it("excludes searchToken when required", async () => {
    pager.options = { includeToken: false };
    const result = await pager.pageInfo(1275);
    const url = new URL(result.query_url as string);
    expect(url.searchParams.has("searchToken")).toEqual(false);
  });

  it("includes extra parameters", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275);
    const url = new URL(result.query_url as string);
    expect(url.searchParams.get("size")).toEqual("5");
  });

  it("does not include options by default", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275);
    expect(!("options" in result)).toBe(true);
  });

  it("includes options on request", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275, { includeOptions: true });
    expect("options" in result).toBe(true);
    expect(
      "queryStringParameters" in (result.options as Record<string, unknown>),
    ).toBe(true);
  });
});
