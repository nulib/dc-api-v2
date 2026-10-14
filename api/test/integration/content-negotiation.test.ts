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
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

describe("Content Negotiation", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("Accept header", () => {
    it("returns a standard JSON response by default", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collections.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections");
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result).toHaveResponseFormat("opensearch");
      const resultBody = await result.json();
      expect(resultBody.data[0].api_model).toEqual("Collection");
    });

    it("returns IIIF in response to Accept: application/ld+json", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collections.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections", {
        headers: { Accept: "application/ld+json" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result).toHaveResponseFormat("iiif");
      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Collection");
      expect(resultBody.label.none[0]).toEqual(
        "Northwestern University Libraries Digital Collections",
      );
    });

    it("query parameter as=iiif takes precedence over Accept header", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collections.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections", {
        queryParams: { as: "opensearch" },
        headers: { Accept: "application/ld+json" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result).toHaveResponseFormat("opensearch");
      const resultBody = await result.json();
      expect(resultBody.data[0].api_model).toEqual("Collection");
    });
  });
});
