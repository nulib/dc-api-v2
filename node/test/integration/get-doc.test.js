"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

describe("Doc retrieval routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /works/{id}", () => {
    const { handler } = requireSource("handlers/get-work-by-id");

    it("retrieves a single work", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

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
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("403's a private work by default", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("returns a private work to allowed IPs", async () => {
      process.env.READING_ROOM_IPS = "10.9.8.7";
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
    });
  });

  describe("GET /collections/{id}", () => {
    const { handler } = requireSource("handlers/get-collection-by-id");

    it("retrieves a single collection", async () => {
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
      expect(resultBody.data.api_model).to.eq("Collection");
      expect(resultBody.data.id).to.eq("1234");
    });
  });

  describe("GET /file-sets/{id}", () => {
    const { handler } = requireSource("handlers/get-file-set-by-id");

    it("retrieves a single file-set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.api_model).to.eq("FileSet");
      expect(resultBody.data.id).to.eq("1234");
    });
  });
});
