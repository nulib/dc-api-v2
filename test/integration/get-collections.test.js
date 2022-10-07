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
    const originalQuery = { size: 10, from: 0 };
    const authQuery = new RequestPipeline(originalQuery).authFilter().toJson();
    const baseEvent = helpers
      .mockEvent("GET", "/collections")
      .pathPrefix("/api/v2");

    describe("validates parameters", () => {
      it("page", async () => {
        const event = baseEvent.queryParams({ page: 0 }).render();
        const result = await handler(event);
        expect(result.statusCode).to.eq(400);
        const resultBody = JSON.parse(result.body);
        expect(resultBody.message).to.eq("page must be >= 1");
      });

      it("size", async () => {
        const event = baseEvent.queryParams({ size: 0 }).render();
        const result = await handler(event);
        expect(result.statusCode).to.eq(400);
        const resultBody = JSON.parse(result.body);
        expect(resultBody.message).to.eq("size must be >= 1");
      });
    });

    it("paginates results using a searchToken and page number", async () => {
      mock
        .post("/dc-v2-collection/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/collections.json"));
      const event = baseEvent.queryParams({ page: 1 }).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });
    });
  });
});
