"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const ApiToken = requireSource("api/api-token");

describe("Authorize a file set by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";
  });

  describe("GET /file-sets/{id}/authorization", () => {
    const { handler } = requireSource("handlers/get-file-set-auth");

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

      const token = new ApiToken().user({ uid: "abc123" }).sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("authorizes a netid, published file set with a valid token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const token = new ApiToken()
        .user({ uid: "abc123" })
        .provider("nusso")
        .sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a netid, published file set with a non-NUSSO token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const token = new ApiToken()
        .user({ uid: "abc123" })
        .provider("test-provider")
        .sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
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

    it("does authorize a netid, published file set with no token if the user is in the reading room", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();

      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted file set if the user is in a Reading Room", async () => {
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

    it("authorizes a netId file set if the request has a superuser token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-netid-1234.json"));

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted unpublished file set if the request has a superuser token", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-restricted-unpublished-1234.json")
        );

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted unpublished file set if the token has an entitlement for a work id", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-restricted-unpublished-1234.json")
        );

      const token = new ApiToken()
        .addEntitlement("756ea5b9-8ca1-4bd7-a70e-4b2082dd0440")
        .sign();

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

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
