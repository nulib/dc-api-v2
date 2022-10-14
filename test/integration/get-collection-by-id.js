"use strict";

const chai = require("chai");
const expect = chai.expect;
const RequestPipeline = require("../../src/api/request/pipeline");

describe("Retrieve collection by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /collections/{id}", () => {
    const { handler } = require("../../src/handlers/get-collection-by-id");

    it("retrieves a single collection link document", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.id).to.eq("1234");
    });

    it("404s a missing collection", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("returns a single collection as a IIIF collection", async () => {
      const originalQuery = {
        query: { query_string: { query: "collection.id:1234" } },
      };
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter()
        .toJson();

      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
      expect(resultBody.label.none[0]).to.eq("Collection Title");
    });
  });
});
