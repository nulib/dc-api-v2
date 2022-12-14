"use strict";

const transformer = require("../../../../src/api/response/opensearch");
const { Paginator } = require("../../../../src/api/pagination");
const chai = require("chai");
const expect = chai.expect;

describe("OpenSearch response transformer", () => {
  let pager;
  beforeEach(() => {
    pager = new Paginator(
      "http://dcapi.library.northwestern.edu/v2/",
      "search",
      ["works"],
      { query: { match_all: {} } }
    );
  });

  it("transforms a doc response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/work-1234.json"),
    };
    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.data).to.be.an("object");
    expect(body).not.to.include.key("pagination");
  });

  it("transforms a search response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/search.json"),
    };
    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.data).to.be.an("array");
    expect(body).to.include.key("pagination");
    expect(body.pagination).to.include.keys([
      "query_url",
      "current_page",
      "limit",
      "next_url",
      "offset",
      "total_hits",
      "total_pages",
    ]);
  });

  it("transforms an error response", async () => {
    const response = {
      statusCode: 404,
      body: helpers.testFixture("mocks/missing-index.json"),
    };

    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(404);

    const body = JSON.parse(result.body);
    expect(body.status).to.eq(404);
    expect(body.error).to.be.a("string");
  });
});
