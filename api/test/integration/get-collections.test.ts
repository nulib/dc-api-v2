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

describe("Collections route", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /collections", () => {
    it("paginates results using default size and page number", async () => {
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
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const body = await result.json();
      const url = new URL(body.pagination.query_url);
      expect(url.searchParams.has("searchToken")).toEqual(false);
      expect(url.searchParams.has("size")).toEqual(false);
    });

    it("paginates results using provided size and page number", async () => {
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
        queryParams: { page: 3, size: 5 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const body = await result.json();
      const url = new URL(body.pagination.query_url);
      expect(url.searchParams.has("searchToken")).toEqual(false);
      expect(url.searchParams.get("size")).toEqual("5");
    });

    it("produces a correct query_url", async () => {
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

      const body = await result.json();
      const queryUrl = new URL(body.pagination.query_url);
      expect(queryUrl.pathname).toEqual("/api/v2/collections");
    });

    it("returns top level collection as a IIIF collection", async () => {
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
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Collection");
      expect(resultBody.label.none[0]).toEqual(
        "Northwestern University Libraries Digital Collections",
      );
      expect(resultBody.summary.none[0]).toEqual(
        "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials.",
      );
      expect(resultBody.items.length).toEqual(69);
    });
  });
});
