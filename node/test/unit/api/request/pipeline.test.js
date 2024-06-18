"use strict";

const chai = require("chai");
const deepEqualInAnyOrder = require("deep-equal-in-any-order");
const expect = chai.expect;

const ApiToken = requireSource("api/api-token");
const RequestPipeline = requireSource("api/request/pipeline");

chai.use(deepEqualInAnyOrder);

const findFilterQuery = (searchContext) => {
  if (!searchContext.search_pipeline?.request_processors) return null;
  const filter = searchContext.search_pipeline.request_processors.find(
    (processor) => processor?.filter_query?.tag == "access_filter"
  );
  return filter?.filter_query?.query?.bool;
};

describe("RequestPipeline", () => {
  helpers.saveEnvironment();

  const requestBody = {
    query: { match: { term: { title: "The Title" } } },
    size: 50,
    from: 0,
    sort: [{ create_date: "asc" }],
    _source: ["id", "title", "collection"],
    aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
  };

  let event, pipeline;
  beforeEach(() => {
    event = helpers.mockEvent("GET", "/search").render();
    pipeline = new RequestPipeline(requestBody);
  });

  it("adds an auth filter", () => {
    event.userToken = new ApiToken();

    const result = pipeline.authFilter(helpers.preprocess(event));
    expect(result.searchContext.size).to.eq(50);
    expect(result.searchContext.query).to.eq(requestBody.query);
    expect(findFilterQuery(result.searchContext)).to.deep.equalInAnyOrder({
      must_not: [
        { term: { visibility: "Private" } },
        { term: { published: false } },
      ],
    });
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
      expect(result.searchContext.query).to.eq(requestBody.query);
      expect(findFilterQuery(result.searchContext)).to.deep.equalInAnyOrder({
        must_not: [
          { term: { visibility: "Private" } },
          { term: { published: false } },
        ],
      });
    });

    it("includes private results if the user is in the reading room", () => {
      event = helpers.preprocess(event);
      event.userToken = new ApiToken().readingRoom();
      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query).to.eq(requestBody.query);
      expect(findFilterQuery(result.searchContext)).to.deep.equal({
        must_not: [{ term: { published: false } }],
      });
    });
  });

  describe("superuser", () => {
    it("filters out private results by default", () => {
      event.userToken = new ApiToken();

      // process.env.READING_ROOM_IPS = "192.168.0.1,172.16.10.2";
      const result = pipeline.authFilter(helpers.preprocess(event));
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query).to.eq(requestBody.query);
      expect(findFilterQuery(result.searchContext)).to.deep.equalInAnyOrder({
        must_not: [
          { term: { visibility: "Private" } },
          { term: { published: false } },
        ],
      });
    });

    it("includes private results if the user is in the reading room", () => {
      event = helpers.preprocess(event);
      event.userToken = new ApiToken().superUser();

      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query).to.eq(requestBody.query);
      expect(findFilterQuery(result.searchContext)).to.be.null;
    });
  });

  describe("search_pipeline in request", () => {
    it("does not add a search filter when a pipeline is specified", () => {
      event.queryStringParameters = {
        ...event.queryStringParameters,
        search_pipeline: "alternate-pipeline",
      };
      const result = pipeline.authFilter(helpers.preprocess(event));
      expect(result.searchContext).not.to.have.keys("search_pipeline");
    });
  });
});
