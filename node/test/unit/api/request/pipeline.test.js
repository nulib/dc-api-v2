"use strict";

const chai = require("chai");
const expect = chai.expect;

const ApiToken = requireSource("api/api-token");
const RequestPipeline = requireSource("api/request/pipeline");

describe("RequestPipeline", () => {
  helpers.saveEnvironment();

  let event = helpers.mockEvent("GET", "/search").render();

  const requestBody = {
    query: { match: { term: { title: "The Title" } } },
    size: 50,
    from: 0,
    sort: [{ create_date: "asc" }],
    _source: ["id", "title", "collection"],
    aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
  };

  let pipeline;
  beforeEach(() => {
    pipeline = new RequestPipeline(requestBody);
  });

  it("adds an auth filter", () => {
    event.userToken = new ApiToken();

    const result = pipeline.authFilter(helpers.preprocess(event));
    expect(result.searchContext.size).to.eq(50);
    expect(result.searchContext.query.bool.must).to.include(requestBody.query);
    expect(result.searchContext.query.bool.must_not).to.deep.include(
      { term: { visibility: "Private" } },
      { term: { published: false } }
    );
  });

  it("serializes JSON", () => {
    expect(JSON.parse(pipeline.toJson())).to.deep.equal(requestBody);
  });

  describe("reading room user", () => {
    it("filters out private results by default", () => {
      event.userToken = new ApiToken();

      // process.env.READING_ROOM_IPS = "192.168.0.1,172.16.10.2";
      const result = pipeline.authFilter(helpers.preprocess(event));
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include(
        { term: { visibility: "Private" } },
        { term: { published: false } }
      );
    });

    it("includes private results if the user is in the reading room", () => {
      event.userToken = new ApiToken().readingRoom();

      const result = pipeline.authFilter(helpers.preprocess(event));
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

  describe("superuser", () => {
    it("filters out private results by default", () => {
      event.userToken = new ApiToken();

      // process.env.READING_ROOM_IPS = "192.168.0.1,172.16.10.2";
      const result = pipeline.authFilter(helpers.preprocess(event));
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include(
        { term: { visibility: "Private" } },
        { term: { published: false } }
      );
    });

    it("includes private results if the user is in the reading room", () => {
      event.userToken = new ApiToken().superUser();

      const result = pipeline.authFilter(helpers.preprocess(event));
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool).not.to.have.any.keys("must_not");
    });
  });
});
