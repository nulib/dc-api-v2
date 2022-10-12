"use strict";

const chai = require("chai");
const expect = chai.expect;

describe("Retrieve shared link by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /resolve/{id}", () => {
    const { handler } = require("../../src/handlers/get-shared-link-by-id");

    it("retrieves a single shared link document", async () => {
      mock
        .get("/shared_links/_doc/1234")
        .reply(200, helpers.testFixture("mocks/shared-link-1234.json"));

      const event = helpers
        .mockEvent("GET", "/resolve/{id}")
        .pathPrefix("/api/v2")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result.headers).to.include({ "content-type": "application/json" });

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.target_id).to.eq(
        "23255308-53f4-4c96-a268-aefa596d9d21"
      );
    });

    it("404s a missing shared link", async () => {
      mock
        .get("/shared_links/_doc/5678")
        .reply(404, helpers.testFixture("mocks/missing-shared-link-5678.json"));

      const event = helpers
        .mockEvent("GET", "/shared_links/{id}")
        .pathPrefix("/api/v2")
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
        .pathPrefix("/api/v2")
        .pathParams({ id: 9101112 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });
  });
});
