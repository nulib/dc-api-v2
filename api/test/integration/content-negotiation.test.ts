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

    it("returns PREMIS XML in response to Accept: application/premis+xml", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
        headers: { Accept: "application/premis+xml" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result).toHaveResponseFormat("premisxml");
    });
  });

  describe("quality values", () => {
    const collectionsMock = () =>
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collections.json")),
            ),
        ),
      );

    it("honors the client's stated preference over header order", async () => {
      collectionsMock();

      const req = buildRequest("GET", "/collections", {
        headers: { Accept: "application/json;q=0.5, application/ld+json" },
      });
      const result = await sendRequest(req);
      expect(result).toHaveResponseFormat("iiif");
    });

    it("treats q=0 as a refusal of that type", async () => {
      collectionsMock();

      const req = buildRequest("GET", "/collections", {
        headers: { Accept: "application/ld+json;q=0, application/json" },
      });
      const result = await sendRequest(req);
      expect(result).toHaveResponseFormat("opensearch");
    });

    it("gives */* the default representation", async () => {
      collectionsMock();

      const req = buildRequest("GET", "/collections", {
        headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      });
      const result = await sendRequest(req);
      expect(result).toHaveResponseFormat("opensearch");
    });

    it("disregards an Accept header it can't satisfy", async () => {
      collectionsMock();

      const req = buildRequest("GET", "/collections", {
        headers: { Accept: "text/csv" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result).toHaveResponseFormat("opensearch");
    });
  });

  describe("the PREMIS family", () => {
    const workMock = () =>
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

    const premisRequest = (headers: Record<string, string> = {}) =>
      buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "premis" },
        headers,
      });

    it("serves XML by default", async () => {
      workMock();

      const result = await sendRequest(premisRequest());
      expect(result).toHaveResponseFormat("premisxml");
    });

    it("serves the JSON projection when the request accepts JSON", async () => {
      workMock();

      const result = await sendRequest(
        premisRequest({ Accept: "application/json" }),
      );
      expect(result).toHaveResponseFormat("premisjson");
      const resultBody = await result.json();
      expect(resultBody.data.premis_version).toBeDefined();
    });
  });

  describe("Vary", () => {
    it("is set on routes that negotiate", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.headers.get("vary") ?? "").toMatch(/Accept/i);
    });

    it("is not set on routes that don't", async () => {
      const req = buildRequest("GET", "/auth/whoami");
      const result = await sendRequest(req);
      expect(result.headers.get("vary") ?? "").not.toMatch(/Accept/i);
    });
  });

  describe("unsupported formats", () => {
    it("returns 406 rather than falling back on search routes", async () => {
      for (const as of ["c2pa", "premis", "bogus"]) {
        const req = buildRequest("GET", "/search", { queryParams: { as } });
        const result = await sendRequest(req);
        expect(result.status).toEqual(406);
      }
    });

    it("returns 406 on item routes", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "c2pa" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(406);
    });
  });

  describe("pagination URLs", () => {
    const searchMock = () =>
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

    it("omits `as` from the URLs of a default response", async () => {
      searchMock();

      const req = buildRequest("GET", "/search", {
        queryParams: { query: "test", size: 1 },
      });
      const result = await sendRequest(req);
      const { pagination } = await result.json();
      expect(new URL(pagination.query_url).searchParams.has("as")).toBe(false);
      expect(new URL(pagination.next_url).searchParams.has("as")).toBe(false);
    });

    it("carries as=iiif when the format was negotiated by header", async () => {
      searchMock();

      const req = buildRequest("GET", "/search", {
        queryParams: { query: "test", size: 1 },
        headers: { Accept: "application/ld+json" },
      });
      const result = await sendRequest(req);
      expect(result).toHaveResponseFormat("iiif");
      const resultBody = await result.json();
      expect(new URL(resultBody.id).searchParams.get("as")).toEqual("iiif");
    });
  });
});
