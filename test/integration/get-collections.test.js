"use strict";

const chai = require("chai");
const expect = chai.expect;
const getCollectionsHandler = require("../../src/handlers/get-collections");
const RequestPipeline = require("../../src/api/request/pipeline");
const { processRequest } = require("../../src/handlers/middleware");
chai.use(require("chai-http"));

describe("Collections route", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /collections", () => {
    const handler = getCollectionsHandler.handler;
    const baseEvent = helpers.mockEvent("GET", "/collections");
    let event;
    const makeQuery = (params) =>
      new RequestPipeline({ query: { match_all: {} }, ...params })
        .authFilter(processRequest(baseEvent))
        .toJson();

    it("paginates results using default size and page number", async () => {
      mock
        .post("/dc-v2-collection/_search", makeQuery({ size: 10, from: 0 }))
        .reply(200, helpers.testFixture("mocks/collections.json"));
      event = baseEvent.render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const {
        pagination: { query_url },
      } = JSON.parse(result.body);
      const url = new URL(query_url);
      expect(url.searchParams.has("searchToken")).to.be.false;
      expect(url.searchParams.has("size")).to.be.false;
    });

    it("paginates results using provided size and page number", async () => {
      mock
        .post("/dc-v2-collection/_search", makeQuery({ size: 5, from: 10 }))
        .reply(200, helpers.testFixture("mocks/collections.json"));
      event = baseEvent.queryParams({ page: 3, size: 5 }).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const {
        pagination: { query_url },
      } = JSON.parse(result.body);
      const url = new URL(query_url);
      expect(url.searchParams.has("searchToken")).to.be.false;
      expect(url.searchParams.get("size")).to.eq("5");
    });

    it("produces a correct query_url from a mounted API Gateway route", async () => {
      mock
        .post("/dc-v2-collection/_search", makeQuery({ size: 10, from: 0 }))
        .reply(200, helpers.testFixture("mocks/collections.json"));
      event = JSON.parse(helpers.testFixture("mocks/real-search-event.json"));
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const {
        pagination: { query_url },
      } = JSON.parse(result.body);
      const url = new URL(query_url);
      expect(url.pathname).to.eq("/api/v2/search/collections");
    });
  });
});
