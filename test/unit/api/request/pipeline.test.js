"use strict";

const RequestPipeline = require("../../../../src/api/request/pipeline");
const chai = require("chai");
const expect = chai.expect;

describe("RequestPipeline", () => {
  const requestBody = {
    query: { match: { term: { title: "The Title" } } },
    size: 50,
    sort: [{ create_date: "asc" }],
    _source: ["id", "title", "collection"],
    aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
  };

  let pipeline;
  beforeEach(() => {
    pipeline = new RequestPipeline(requestBody);
  });

  it("adds an auth filter", () => {
    const result = pipeline.authFilter();
    expect(result.searchContext.size).to.eq(50);
    expect(result.searchContext.query.bool.must).to.include(requestBody.query);
    expect(result.searchContext.query.bool.must_not).to.deep.include(
      { term: { visibility: "Private" } },
      { term: { published: false } }
    );
  });

  it("sets a default query", () => {
    const result = new RequestPipeline({ size: 20 }).authFilter();
    expect(result.searchContext.size).to.eq(20);
    expect(result.searchContext.query.bool.must).to.deep.include({
      match_all: {},
    });
  });

  it("serializes JSON", () => {
    expect(JSON.parse(pipeline.toJson())).to.deep.equal(requestBody);
  });
});
