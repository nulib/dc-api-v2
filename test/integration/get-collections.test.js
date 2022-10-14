"use strict";

const chai = require("chai");
const expect = chai.expect;
const getCollectionsHandler = require("../../src/handlers/get-collections");
const RequestPipeline = require("../../src/api/request/pipeline");

describe("Collections route", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /collections", () => {
    const handler = getCollectionsHandler.handler;
    const baseEvent = helpers
      .mockEvent("GET", "/collections")
      .pathPrefix("/api/v2");
    let event;
    const makeQuery = (params) =>
      new RequestPipeline(params).authFilter().toJson();

    describe("validates parameters", () => {
      it("page", async () => {
        event = baseEvent.queryParams({ page: 0 }).render();
        const result = await handler(event);
        expect(result.statusCode).to.eq(400);
        const resultBody = JSON.parse(result.body);
        expect(resultBody.message).to.eq("page must be >= 1");
      });

      it("size", async () => {
        event = baseEvent.queryParams({ size: 0 }).render();
        const result = await handler(event);
        expect(result.statusCode).to.eq(400);
        const resultBody = JSON.parse(result.body);
        expect(resultBody.message).to.eq("size must be >= 1");
      });
    });

    it("paginates results using default size and page number", async () => {
      mock
        .post("/dc-v2-collection/_search", makeQuery({ size: 10, from: 0 }))
        .reply(200, helpers.testFixture("mocks/collections.json"));
      event = baseEvent.render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });
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
      expect(result.headers).to.include({ "content-type": "application/json" });
      const {
        pagination: { query_url },
      } = JSON.parse(result.body);
      const url = new URL(query_url);
      expect(url.searchParams.has("searchToken")).to.be.false;
      expect(url.searchParams.get("size")).to.eq("5");
    });
  });
});
