"use strict";

const chai = require("chai");
const deepEqualInAnyOrder = require("deep-equal-in-any-order");
const expect = chai.expect;

const ApiToken = requireSource("api/api-token");
const RequestPipeline = requireSource("api/request/pipeline");

chai.use(deepEqualInAnyOrder);

describe("RequestPipeline", () => {
  helpers.saveEnvironment();

  let event;
  let pipeline;
  let requestBody;
  beforeEach(() => {
    requestBody = {
      query: { match: { term: { title: "The Title" } } },
      size: 50,
      from: 0,
      sort: [{ create_date: "asc" }],
      _source: ["id", "title", "collection"],
      aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
    };
    event = helpers.preprocess(helpers.mockEvent("GET", "/search").render());
    pipeline = new RequestPipeline(requestBody);
  });

  it("adds an auth filter", () => {
    event.userToken = new ApiToken();

    const result = pipeline.authFilter(event);
    expect(result.searchContext.size).to.eq(50);
    expect(result.searchContext.query.bool.must).to.deep.include(
      requestBody.query
    );
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
      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.deep.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include(
        { term: { visibility: "Private" } },
        { term: { published: false } }
      );
    });

    it("includes private results if the user is in the reading room", () => {
      event = helpers.preprocess(event);
      event.userToken = new ApiToken().readingRoom();

      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.deep.include(
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
      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.deep.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.deep.include(
        { term: { visibility: "Private" } },
        { term: { published: false } }
      );
    });

    it("includes private results if the user is in the reading room", () => {
      event = helpers.preprocess(event);
      event.userToken = new ApiToken().superUser();

      const result = pipeline.authFilter(event);
      expect(result.searchContext.size).to.eq(50);
      expect(result.searchContext.query.bool.must).to.deep.include(
        requestBody.query
      );
      expect(result.searchContext.query.bool.must_not).to.be.empty;
    });
  });

  describe("hybrid", () => {
    it("applies the filter to all subqueries", () => {
      event.userToken = new ApiToken();
      requestBody.query = {
        hybrid: {
          queries: [
            {
              neural: {
                embedding: {
                  query_text:
                    "Do you have any materials related to testing the request pipeline?",
                  model_id: "MODEL_ID",
                  k: 5,
                },
              },
            },
            {
              match: {
                all_titles: {
                  query:
                    "Do you have any materials related to testing the request pipeline?",
                  operator: "AND",
                  analyzer: "english",
                },
              },
            },
          ],
        },
      };
      pipeline = new RequestPipeline(requestBody);
      const result = pipeline.authFilter(event);
      for (const i in requestBody.query.hybrid.queries) {
        const originalQuery = requestBody.query.hybrid.queries[i];
        const newQuery = result.searchContext.query.hybrid.queries[i];
        expect(newQuery.bool.must).to.deep.include(originalQuery);
        expect(newQuery.bool.must_not).to.deep.include(
          { term: { visibility: "Private" } },
          { term: { published: false } }
        );
      }
    });
  });
});
