"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const ApiToken = requireSource("api/api-token");

describe("Authorize a work by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abc123";
    process.env.API_TOKEN_NAME = "dcapiTEST";
  });

  describe("GET /works/{id}/authorization", () => {
    const { handler } = requireSource("handlers/get-work-auth");

    it("authorizes a public, published work set with no token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a public, unpublished work even with a valid token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/unpublished-work-1234.json"));

      const token = new ApiToken().user({ uid: "abc123" }).sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("authorizes a netid, published work with a valid token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-netid-1234.json"));

      const token = new ApiToken().user({ uid: "abc123" }).sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a netid, published work with no token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-netid-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("does authorize a netid, published work with no token if the user is in the reading room", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-netid-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();

      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;
      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted work if the user is in a Reading Room", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-restricted-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("does not authorize a restricted, unpublished work if the user is in a Reading Room", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-restricted-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .render();
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a netId work if the request has a superuser token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-netid-1234.json"));

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted unpublished work if the request has a superuser token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/work-restricted-unpublished-1234.json")
        );

      const token = new ApiToken().superUser().sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
    });

    it("authorizes a restricted unpublished work if the token has an entitlement for a work id", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/work-restricted-unpublished-1234.json")
        );

      const token = new ApiToken()
        .addEntitlement("756ea5b9-8ca1-4bd7-a70e-4b2082dd0440")
        .sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/authorization")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(204);
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
  });
});
