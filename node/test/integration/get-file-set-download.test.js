"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const ApiToken = requireSource("api/api-token");

describe("Returns unauthorized without a superUser token", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";
  });

  describe("GET /file-sets/{id}/download", () => {
    const { handler } = requireSource("handlers/get-file-set-download");

    it("returns unauthorized without a token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/download")
        .pathParams({ id: 1234 })
        .queryParams({ email: "example@example.com" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(401);
    });

    it("returns an error if the mime-type is not video/*", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/download")
        .pathParams({ id: 1234 })
        .queryParams({ email: "example@example.com" })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(405);
    });

    it("returns an error if it does not contain an email query string parameters", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/download")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
    });
  });
});
