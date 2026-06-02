import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "bun:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

describe("Authorize a work by id", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /works/{id}/authorization", () => {
    it("authorizes a public, published work set with no token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a public, unpublished work even with a valid token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().user({ sub: "abc123" }).sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("authorizes a netid, published work with a valid token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken()
        .user({ sub: "abc123" })
        .provider("nusso")
        .sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a netid, published work with a non-NUSSO token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken()
        .user({ sub: "abc123" })
        .provider("test-provider")
        .sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("does not authorize a netid, published work with no token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-netid-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("does authorize a netid, published work with no token if the user is in the reading room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-netid-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted work if the user is in a Reading Room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-restricted-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a restricted, unpublished work if the user is in a Reading Room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-restricted-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a netId work if the request has a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted unpublished work if the request has a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/work-restricted-unpublished-1234.json"),
              ),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted unpublished work if the token has an entitlement for a work id", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/work-restricted-unpublished-1234.json"),
              ),
            ),
        ),
      );

      const token = await new ApiToken()
        .addEntitlement("756ea5b9-8ca1-4bd7-a70e-4b2082dd0440")
        .sign();
      const req = buildRequest("GET", "/works/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("404s a missing work", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });
  });
});
