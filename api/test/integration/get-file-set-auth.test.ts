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

describe("Authorize a file set by id", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /file-sets/{id}/authorization", () => {
    it("authorizes a public, published file set with no token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a public, unpublished file set even with a valid token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-unpublished-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().user({ sub: "abc123" }).sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("authorizes a netid, published file set with a valid token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken()
        .user({ sub: "abc123" })
        .provider("nusso")
        .sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a netid, published file set with a non-NUSSO token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken()
        .user({ sub: "abc123" })
        .provider("test-provider")
        .sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("does not authorize a netid, published file set with no token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-netid-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("does authorize a netid, published file set with no token if the user is in the reading room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-netid-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted file set if the user is in a Reading Room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-restricted-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("does not authorize a restricted, unpublished file set if the user is in a Reading Room", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-restricted-1234.json")),
            ),
        ),
      );

      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a netId file set if the request has a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-netid-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted unpublished file set if the request has a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-restricted-unpublished-1234.json"),
              ),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("authorizes a restricted unpublished file set if the token has an entitlement for a work id", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-restricted-unpublished-1234.json"),
              ),
            ),
        ),
      );

      const token = await new ApiToken()
        .addEntitlement("756ea5b9-8ca1-4bd7-a70e-4b2082dd0440")
        .sign();
      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });

    it("404s a missing file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("does not authorize a file set with invalid visibility value", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-baddata-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("authorizes requests for IDs in the always-allow namespace", async () => {
      const id = "00000000-0000-0000-0000-000000000001";

      server.use(
        http.get(`/dc-v2-file-set/_doc/${id}`, () =>
          HttpResponse.json({ found: false }, { status: 404 }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/authorization", {
        pathParams: { id },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(204);
    });
  });
});
