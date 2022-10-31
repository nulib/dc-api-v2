"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

describe("Retrieve shared link by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /shared-links/{id}", () => {
    const { handler } = require("../../src/handlers/get-shared-link-by-id");

    it("retrieves a single shared link document", async () => {
      mock
        .get("/shared_links/_doc/1234")
        .reply(200, helpers.testFixture("mocks/shared-link-1234.json"));

      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/shared-links/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.api_model).to.eq("Work");
      expect(resultBody.data.visibility).to.eq("Private");
    });

    it("404s a missing shared link", async () => {
      mock
        .get("/shared_links/_doc/5678")
        .reply(404, helpers.testFixture("mocks/missing-shared-link-5678.json"));

      const event = helpers
        .mockEvent("GET", "/shared_links/{id}")
        .pathParams({ id: 5678 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("404s an expired shared link", async () => {
      mock
        .get("/shared_links/_doc/9101112")
        .reply(
          200,
          helpers.testFixture("mocks/expired-shared-link-9101112.json")
        );

      const event = helpers
        .mockEvent("GET", "/shared_links/{id}")
        .pathParams({ id: 9101112 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("retrieves an unpublished single shared link document", async () => {
      mock
        .get("/shared_links/_doc/1234")
        .reply(200, helpers.testFixture("mocks/shared-link-1234.json"));

      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/private-unpublished-work-1234.json")
        );

      const event = helpers
        .mockEvent("GET", "/shared-links/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.api_model).to.eq("Work");
      expect(resultBody.data.visibility).to.eq("Private");
    });

    it("returns a 404 when the link exists but the work doesn't", async () => {
      mock
        .get("/shared_links/_doc/1234")
        .reply(200, helpers.testFixture("mocks/shared-link-1234.json"));

      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/shared-links/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });
  });
});
