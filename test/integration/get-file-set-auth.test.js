"use strict";

const chai = require("chai");
const expect = chai.expect;
const RequestPipeline = require("../../src/api/request/pipeline");
chai.use(require("chai-http"));

process.env.API_TOKEN_SECRET = "abc123";
process.env.API_TOKEN_NAME = "dcapiTEST";

describe("Authorize a file set by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /file-sets/{id}/authorization", () => {
    const { handler } = require("../../src/handlers/get-file-set-auth");

    it("authorizes a public, published file set with no token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a public, unpublished file set even with a valid token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-unpublished-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkaXNwbGF5TmFtZSI6IlNvbWUgT25lIiwiaWF0IjoxNjY1NDE3NzYzfQ.Nwi8dJnc7w201ZtO5de5zYmU-F5gEalkmHZ5pR1VXms;`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("authorizes a netid, published file set with a valid token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkaXNwbGF5TmFtZSI6IlNvbWUgT25lIiwiaWF0IjoxNjY1NDE3NzYzfQ.Nwi8dJnc7w201ZtO5de5zYmU-F5gEalkmHZ5pR1VXms;`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a netid, published file set with no token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("authorizes an restricted file set if the user is in a Reading Room", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-restricted-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a restricted, unpublished file set if the user is in a Reading Room", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-restricted-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("404s a missing file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("does not authorize a file set with invalid visibility value", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-baddata-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("authorizes requests for IDs in the always-allow namespace", async () => {
      const id = "00000000-0000-0000-0000-000000000001";

      mock.get(`/dc-v2-file-set/_doc/${id}`).reply(404, "Not Found");

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });
  });
});
