"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const RequestPipeline = requireSource("api/request/pipeline");

describe("Retrieve collection by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /collections/{id}", () => {
    const { handler } = requireSource("handlers/get-collection-by-id");

    it("retrieves a single collection link document", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.id).to.eq("1234");
    });

    it("404s a missing collection", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
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
        .authFilter(helpers.preprocess({}))
        .toJson();

      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
      expect(resultBody.label.none[0]).to.eq("Collection Title");
    });
  });
});
