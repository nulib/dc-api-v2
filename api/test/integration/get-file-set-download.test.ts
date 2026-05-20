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

describe("Download file set", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /file-sets/{id}/download", () => {
    it("returns unauthorized for a video without a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-video-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/download", {
        pathParams: { id: 1234 },
        queryParams: { email: "example@example.com" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(401);
    });

    it("returns unauthorized for an audio without a superuser token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-audio-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/download", {
        pathParams: { id: 1234 },
        queryParams: { email: "example@example.com" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(401);
    });

    it("returns an error for video if it does not contain an email query string parameters", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-video-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/file-sets/{id}/download", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });

    it("returns an error for audio if it does not contain an email query string parameters", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-audio-1234.json")),
            ),
        ),
      );

      const token = await new ApiToken().superUser().sign();
      const req = buildRequest("GET", "/file-sets/{id}/download", {
        pathParams: { id: 1234 },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });
  });
});
