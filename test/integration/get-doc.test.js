"use strict";

const chai = require("chai");
const expect = chai.expect;

describe("Doc retrieval routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /works/{id}", () => {
    const { handler } = require("../../src/handlers/get-work-by-id");

    it("retrieves a single work", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.api_model).to.eq("Work");
      expect(resultBody.data.id).to.eq("1234");
    });

    it("404s a missing work", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("404s an unpublished work", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/unpublished-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });
  });

  describe("GET /collections/{id}", () => {
    const { handler } = require("../../src/handlers/get-collection-by-id");

    it("retrieves a single collection", async () => {
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
      expect(resultBody.data.api_model).to.eq("Collection");
      expect(resultBody.data.id).to.eq("1234");
    });
  });

  describe("GET /file-sets/{id}", () => {
    const { handler } = require("../../src/handlers/get-file-set-by-id");

    it("retrieves a single file-set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.api_model).to.eq("FileSet");
      expect(resultBody.data.id).to.eq("1234");
    });
  });
});
