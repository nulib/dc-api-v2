"use strict";

const chai = require("chai");
const expect = chai.expect;

const { decodeSearchToken, Paginator } = requireSource("api/pagination");

describe("Paginator", function () {
  const requestBody = {
    query: { match_all: {} },
    size: 50,
    sort: [{ create_date: "asc" }],
    _source: ["id", "title", "collection"],
    aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
  };

  let pager;

  this.beforeEach(() => {
    pager = new Paginator(
      "https://api.test.library.northwestern.edu/api/v2/",
      "search",
      ["works"],
      requestBody
    );
  });

  it("produces page 1 pagination", async () => {
    let result = await pager.pageInfo(1275);
    expect(result.current_page).to.eq(1);
    expect(result.offset).to.eq(0);
    expect(result.limit).to.eq(50);
    expect(result.total_hits).to.eq(1275);
    expect(result.total_pages).to.eq(26);
    expect(result.prev_url).to.be.undefined;

    let url = new URL(result.next_url);
    expect(url.host).to.eq("api.test.library.northwestern.edu");
    expect(url.pathname).to.eq("/api/v2/search");
    expect(url.searchParams.get("page")).to.eq("2");
  });

  it("produces additional page pagination", async () => {
    pager.body.from = 100;
    let result = await pager.pageInfo(1275);
    expect(result.current_page).to.eq(3);
    expect(new URL(result.prev_url).searchParams.get("page")).to.eq("2");
    expect(new URL(result.next_url).searchParams.get("page")).to.eq("4");
    expect(requestBody.from).to.be.undefined;
  });

  it("produces last page pagination", async () => {
    pager.body.from = 1270;
    const result = await pager.pageInfo(1275);
    expect(result.next_url).to.be.undefined;
  });

  it("produces a usable token", async () => {
    pager.body.from = 100;
    const result = await pager.pageInfo(1275);
    const token = new URL(result.query_url).searchParams.get("searchToken");
    const rehydrated = await decodeSearchToken(token);

    expect(rehydrated.models).to.include.members(["works"]);
    for (const field of ["query", "size", "sort", "_source"]) {
      expect(rehydrated.body[field]).to.deep.equal(requestBody[field]);
    }
    expect(rehydrated.body).not.to.include.keys(["aggs", "from"]);
  });

  it("correctly sets the default size", async () => {
    delete pager.body.size;
    const result = await pager.pageInfo(1275);
    expect(result.limit).to.eq(10);
  });

  it("excludes searchToken when required", async () => {
    pager.options = { includeToken: false };
    const result = await pager.pageInfo(1275);
    const url = new URL(result.query_url);
    expect(url.searchParams.has("searchToken")).to.be.false;
  });

  it("includes extra parameters", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275);
    const url = new URL(result.query_url);
    expect(url.searchParams.get("size")).to.eq("5");
  });

  it("does not include options by default", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275);
    expect(result).not.to.have.key("options");
  });

  it("includes options on request", async () => {
    pager.options = { queryStringParameters: { size: 5 } };
    const result = await pager.pageInfo(1275, { includeOptions: true });
    expect(result.options).to.have.key("queryStringParameters");
  });
});
