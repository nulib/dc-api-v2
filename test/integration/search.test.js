"use strict";

const chai = require("chai");
const expect = chai.expect;
const searchHandlers = require("../../src/handlers/search");
const RequestPipeline = require("../../src/api/request/pipeline");

chai.use(require("chai-http"));

describe("Search routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("POST /search/{targets}", () => {
    const handler = searchHandlers.postSearch;
    const originalQuery = { query: { match_all: {} } };
    const authQuery = new RequestPipeline(originalQuery)
      .authFilter(helpers.preprocess({}))
      .toJson();

    it("performs a works search by default", async () => {
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));
      const event = helpers
        .mockEvent("POST", "/search")
        .body(originalQuery)
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

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
        .pathParams({ models: "works,collections" })
        .body(originalQuery)
        .base64Encode()
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

      const resultBody = JSON.parse(result.body);
      expect(resultBody).to.include.keys(["data", "pagination"]);
      expect(resultBody.data.length).to.eq(10);
    });

    it("errors if invalid models specified", async () => {
      const event = helpers
        .mockEvent("POST", "/search/{models}")
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
    const originalQuery = { query: { match_all: {} } };
    const authQuery = new RequestPipeline(originalQuery)
      .authFilter(helpers.preprocess({}))
      .toJson();
    const searchToken =
      "N4IgRg9gJgniBcoCOBXApgJzokBbAhgC4DGAFgPr4A2VCwAvvQDQgDOAlgF5oICMADMzzQ0VVggDaIAO4QMAa3EBdekA";

    it("Does not require a searchToken", async () => {
      const originalQuery = {
        query: { query_string: { query: "*" } },
      };
      const event = helpers.mockEvent("GET", "/search").queryParams().render();

      const authQuery = new RequestPipeline(originalQuery)
        .authFilter(helpers.preprocess(event))
        .toJson();

      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const resultBody = JSON.parse(result.body);
      expect(resultBody.pagination.next_url).not.null;
      expect(resultBody.pagination.current_page).to.eq(1);
    });

    it("Errors on invalid searchToken", async () => {
      const event = helpers
        .mockEvent("GET", "/search")
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
        .queryParams({ searchToken, page: 1 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
    });

    it("defaults to page 1", async () => {
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/search")
        .queryParams({ searchToken })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
    });

    it("will return a IIIF collection", async () => {
      const originalQuery = {
        query: { query_string: { query: "*" } },
      };
      const event = helpers
        .mockEvent("GET", "/search")
        .queryParams({ as: "iiif" })
        .render();
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter(helpers.preprocess(event))
        .toJson();

      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
    });

    it("allows sorting via query string parameters", async () => {
      const originalQuery = {
        query: { query_string: { query: "*" } },
        sort: [{ create_date: "asc" }, { modified_date: "desc" }],
      };
      const event = helpers
        .mockEvent("GET", "/search")
        .queryParams({ sort: "create_date:asc,modified_date:desc" })
        .render();
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter(helpers.preprocess(event))
        .toJson();

      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.pagination.query_url).to.contain(
        "?sort=create_date%3Aasc%2Cmodified_date%3Adesc"
      );
    });
  });
});
