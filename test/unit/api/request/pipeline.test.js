"use strict";

const RequestPipeline = require("../../../../src/api/request/pipeline");
const chai = require("chai");
const expect = chai.expect;

describe("RequestPipeline", () => {
  helpers.saveEnvironment();

  const event = helpers.mockEvent("GET", "/search").render();

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

  it("sets a default query", () => {
    const result = new RequestPipeline({ size: 20 }).authFilter(event);
    expect(result.searchContext.size).to.eq(20);
    expect(result.searchContext.query.bool.must).to.deep.include({
      match_all: {},
    });
  });

  it("serializes JSON", () => {
    expect(JSON.parse(pipeline.toJson())).to.deep.equal(requestBody);
  });

  describe("reading room IPs", () => {
    it("filters out private results by default", () => {
      process.env.READING_ROOM_IPS = "192.168.0.1,172.16.10.2";
      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include(
        { term: { visibility: "Private" } },
        { term: { published: false } }
      );
    });

    it("includes private results from allowed IP addresses", () => {
      process.env.READING_ROOM_IPS = "127.0.0.1,192.168.0.1";
      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include({
        term: { published: false },
      });
      expect(result.searchContext.query.bool.must_not).not.to.deep.include({
        term: { visibility: "Private" },
      });
    });
  });
});
