"use strict";

const chai = require("chai");
const expect = chai.expect;
const searchHandlers = require("../../src/handlers/search");
const RequestPipeline = require("../../src/api/request/pipeline");

describe("Search routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("POST /search/{targets}", () => {
    const handler = searchHandlers.postSearch;
    const originalQuery = { query: { match_all: {} } };
    const authQuery = new RequestPipeline(originalQuery).authFilter().toJson();

    it("performs a works search by default", async () => {
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));
      const event = helpers
        .mockEvent("POST", "/search")
        .pathPrefix("/api/v2")
        .body(originalQuery)
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const resultBody = JSON.parse(result.body);
      expect(resultBody).to.include.keys(["data", "pagination"]);
      expect(resultBody.data.length).to.eq(10);
    });

    it("performs a search on specified models", async () => {
      mock
        .post("/dc-v2-work,dc-v2-collection/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search-multiple-targets.json"));
      const event = helpers
        .mockEvent("POST", "/search/{models}")
        .pathPrefix("/api/v2")
        .pathParams({ models: "works,collections" })
        .body(originalQuery)
        .base64Encode()
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const resultBody = JSON.parse(result.body);
      expect(resultBody).to.include.keys(["data", "pagination"]);
      expect(resultBody.data.length).to.eq(10);
    });

    it("errors if invalid models specified", async () => {
      const event = helpers
        .mockEvent("POST", "/search/{models}")
        .pathPrefix("/api/v2")
        .pathParams({ models: "works,collections,blargh" })
        .body(originalQuery)
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);

      const resultBody = JSON.parse(result.body);
      expect(resultBody.message).to.eq(
        "Invalid models requested: works,collections,blargh"
      );
    });
  });

  describe("GET /search", () => {
    const handler = searchHandlers.getSearch;
    const originalQuery = { query: { match_all: {} }, size: 10, from: 0 };
    const authQuery = new RequestPipeline(originalQuery).authFilter().toJson();
    const searchToken =
      "N4IgRg9gJgniBcoCOBXApgJzokBbAhgC4DGAFgPr4A2VCwAvvQDQgDOAlgF5oICMADMzzQ0VVggDaIAO4QMAa3EBdekA";

    it("Does not require a searchToken", async () => {
      const originalQuery = {
        query: { query_string: { query: "*" } },
      };
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter()
        .toJson();

      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));
      const event = helpers
        .mockEvent("GET", "/search")
        .pathPrefix("/api/v2")
        .queryParams()
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.pagination.next_url).not.null;
      expect(resultBody.pagination.current_page).to.eq(1);
    });

    it("Errors on invalid searchToken", async () => {
      const event = helpers
        .mockEvent("GET", "/search")
        .pathPrefix("/api/v2")
        .queryParams({ searchToken: "Ceci n'est pas une searchToken" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.message).to.eq("searchToken is invalid");
    });

    it("performs a search using a searchToken and page number", async () => {
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/search")
        .pathPrefix("/api/v2")
        .queryParams({ searchToken, page: 1 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
    });

    it("defaults to page 1", async () => {
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/search")
        .pathPrefix("/api/v2")
        .queryParams({ searchToken })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
    });

    it("will return a IIIF collection", async () => {
      const originalQuery = {
        query: { query_string: { query: "*" } },
      };
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter()
        .toJson();

      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/search")
        .pathPrefix("/api/v2")
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
    });
  });
});
