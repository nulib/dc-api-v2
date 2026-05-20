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
import RequestPipeline from "../../src/api/request/pipeline.ts";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

describe("Search routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("POST /search/{targets}", () => {
    const originalQuery = { query: { match_all: {} } };

    it("performs a works search by default", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("POST", "/search", {
        body: originalQuery,
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      const keys = Object.keys(resultBody);
      expect(keys.join(",")).toContain("data");
      expect(keys.join(",")).toContain("pagination");
      expect(resultBody.data.length).toEqual(10);
    });

    it("performs a search on specified models", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work,dc-v2-collection/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/search-multiple-targets.json")),
            ),
        ),
      );

      const req = buildRequest("POST", "/search/{models}", {
        pathParams: { models: "works,collections" },
        body: originalQuery,
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      const keys = Object.keys(resultBody);
      expect(keys.join(",")).toContain("data");
      expect(keys.join(",")).toContain("pagination");
      expect(resultBody.data.length).toEqual(10);
    });

    it("errors if invalid models specified", async () => {
      const req = buildRequest("POST", "/search/{models}", {
        pathParams: { models: "works,collections,blargh" },
        body: originalQuery,
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(400);

      const resultBody = await result.json();
      expect(resultBody.message).toEqual(
        "Invalid models requested: works,collections,blargh",
      );
    });
  });

  describe("GET /search", () => {
    const searchToken =
      "N4IgRg9gJgniBcoCOBXApgJzokBbAhgC4DGAFgPr4A2VCwAvvQDQgDOAlgF5oICMADMzzQ0VVggDaIAO4QMAa3EBdekA";

    it("Does not require a searchToken", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search");
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      expect(resultBody.pagination.next_url).toBeDefined();
      expect(resultBody.pagination.current_page).toEqual(1);
    });

    it("Errors on invalid searchToken", async () => {
      const req = buildRequest("GET", "/search", {
        queryParams: { searchToken: "Ceci n'est pas une searchToken" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      const resultBody = await result.json();
      expect(resultBody.message).toEqual("searchToken is invalid");
    });

    it("performs a search using a searchToken and page number", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { searchToken, page: 1 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
    });

    it("defaults to page 1", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { searchToken },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
    });

    it("will return a IIIF collection", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Collection");
    });

    it("allows sorting via query string parameters", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { sort: "create_date:asc,modified_date:desc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      const resultBody = await result.json();
      expect(resultBody.pagination.query_url).toContain(
        "?sort=create_date%3Aasc%2Cmodified_date%3Adesc",
      );
    });

    it("allows excluding fields via query string parameters for GET requests", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { _source_excludes: "title" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      const resultBody = await result.json();
      expect(resultBody.pagination.query_url).toContain(
        "?_source_excludes=title",
      );
    });

    it("allows including fields via query string parameters for GET requests", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/search", {
        queryParams: { _source_includes: "title,accession_number" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      const resultBody = await result.json();
      expect(resultBody.pagination.query_url).toContain(
        "?_source_includes=title%2Caccession_number",
      );
    });

    it("returns the query when as=_explain is specified", async () => {
      const originalQueryExplain = {
        query: { query_string: { query: "*" } },
      };
      const explainParams = new URLSearchParams({ as: "_explain" });
      const explainAuthQuery = new RequestPipeline(originalQueryExplain)
        .authFilter(new ApiToken(), explainParams)
        .toJson();
      const expectedQuery = JSON.parse(explainAuthQuery);

      const req = buildRequest("GET", "/search", {
        queryParams: { as: "_explain" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      const resultBody = await result.json();
      expect(resultBody.models).toEqual("dc-v2-work");
      expect(resultBody.body).toEqual(expectedQuery);
    });
  });
});
