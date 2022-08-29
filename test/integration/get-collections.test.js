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
    const searchToken =
      "N4IgRg9gJgniBcoDOBLAXgUwQRgAwF8AaEAW2gwBskEBtEAYwgoo3oBcUIA7agXXyA";

    it("requires a valid searchToken", async () => {
      const event = helpers
        .mockEvent("GET", "/collections")
        .pathPrefix("/api/v2")
        .queryParams({ searchToken: "Ceci n'est pas une searchToken" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.message).to.eq("searchToken is invalid");
    });

    it("paginates results using a searchToken and page number", async () => {
      mock
        .post("/dc-v2-collection/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/collections.json"));
      const event = helpers
        .mockEvent("GET", "/collections")
        .pathPrefix("/api/v2")
        .queryParams({ searchToken, page: 1 })
        .body(authQuery)
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
    });
  });
});
