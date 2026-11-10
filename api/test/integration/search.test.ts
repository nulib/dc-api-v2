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
  clearEmbeddingCache,
  setEmbeddingClient,
} from "../../src/api/embeddings.ts";
import { decodeSearchToken } from "../../src/api/pagination.ts";
import RequestPipeline from "../../src/api/request/pipeline.ts";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

interface SemanticSearchBody {
  query: {
    neural?: unknown;
    knn: {
      embedding: {
        vector: number[];
        k: number;
        filter: { bool: { filter: unknown[] } };
      };
    };
  };
}

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
      expect(result).toHaveResponseFormat("opensearch");
      const resultBody = await result.json();
      const keys = Object.keys(resultBody);
      expect(keys.join(",")).toContain("data");
      expect(keys.join(",")).toContain("pagination");
      expect(resultBody.data.length).toEqual(10);
    });

    describe("semantic search", () => {
      const neuralQuery = {
        query: { neural: { embedding: { query_text: "jazz posters", k: 5 } } },
      };

      afterEach(() => {
        setEmbeddingClient(undefined);
        clearEmbeddingCache();
      });

      it("sends OpenSearch a knn query built from the embedded text", async () => {
        setEmbeddingClient({
          send: async () => ({
            Payload: Buffer.from(JSON.stringify({ embeddings: [[0.1, 0.2]] })),
          }),
        } as never);

        let searchBody: SemanticSearchBody | undefined;
        server.use(
          http.post(
            "https://index.test.library.northwestern.edu/dc-v2-work/_search",
            async ({ request }) => {
              searchBody = (await request.json()) as SemanticSearchBody;
              return HttpResponse.json(
                JSON.parse(testFixture("mocks/search.json")),
              );
            },
          ),
        );

        const result = await sendRequest(
          buildRequest("POST", "/search", { body: neuralQuery }),
        );
        expect(result.status).toEqual(200);
        expect(searchBody?.query.neural).toBeUndefined();
        const knn = searchBody!.query.knn.embedding;
        expect(knn.vector).toEqual([0.1, 0.2]);
        expect(knn.k).toEqual(5);
        expect(knn.filter.bool.filter).toEqual([
          { terms: { published: [true] } },
          { terms: { visibility: ["Institution", "Public"] } },
        ]);
      });

      it("searches file set image embeddings, one result per work", async () => {
        setEmbeddingClient({
          send: async () => ({
            Payload: Buffer.from(JSON.stringify({ embeddings: [[0.1, 0.2]] })),
          }),
        } as never);

        let searchBody:
          | (SemanticSearchBody & Record<string, unknown>)
          | undefined;
        server.use(
          http.post(
            "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
            async ({ request }) => {
              searchBody = (await request.json()) as typeof searchBody;
              return HttpResponse.json(
                JSON.parse(testFixture("mocks/search.json")),
              );
            },
          ),
        );

        const result = await sendRequest(
          buildRequest("POST", "/search/{models}", {
            pathParams: { models: "file-sets" },
            body: {
              query: {
                neural: {
                  embedding: {
                    query_text: "a vinyl record",
                    k: 20,
                    filter: { term: { role: "Access" } },
                  },
                },
              },
              collapse: { field: "work_id" },
              _source: { exclude: ["embedding"] },
            },
          }),
        );

        expect(result.status).toEqual(200);
        const knn = searchBody!.query.knn.embedding;
        expect(knn.vector).toEqual([0.1, 0.2]);
        expect(knn.k).toEqual(20);
        expect(knn.filter.bool.filter).toEqual([
          { terms: { published: [true] } },
          { terms: { visibility: ["Institution", "Public"] } },
          { term: { role: "Access" } },
        ]);
        expect(searchBody!.collapse).toEqual({ field: "work_id" });
        expect(searchBody!.aggs).toEqual({
          __pagination: { cardinality: { field: "work_id" } },
        });
      });

      it("searches works and file sets together", async () => {
        setEmbeddingClient({
          send: async () => ({
            Payload: Buffer.from(JSON.stringify({ embeddings: [[0.1, 0.2]] })),
          }),
        } as never);

        let searched = false;
        server.use(
          http.post(
            "https://index.test.library.northwestern.edu/dc-v2-work,dc-v2-file-set/_search",
            () => {
              searched = true;
              return HttpResponse.json(
                JSON.parse(testFixture("mocks/search-multiple-targets.json")),
              );
            },
          ),
        );

        const result = await sendRequest(
          buildRequest("POST", "/search/{models}", {
            pathParams: { models: "works,file-sets" },
            body: neuralQuery,
          }),
        );
        expect(result.status).toEqual(200);
        expect(searched).toBe(true);
      });

      describe("has_file_set", () => {
        const workId = "9a2a8af3-4d04-4bae-ad0a-711c5504be84";
        const multimodalQuery = {
          query: {
            hybrid: {
              queries: [
                { query_string: { query: "jazz posters" } },
                {
                  has_file_set: {
                    query: {
                      neural: {
                        embedding: { query_text: "jazz posters", k: 500 },
                      },
                    },
                  },
                },
              ],
            },
          },
          search_pipeline: { phase_results_processors: [] },
        };

        beforeEach(() => {
          setEmbeddingClient({
            send: async () => ({
              Payload: Buffer.from(
                JSON.stringify({ embeddings: [[0.1, 0.2]] }),
              ),
            }),
          } as never);
        });

        it("joins works to their best matching file sets", async () => {
          let fileSetBody: Record<string, unknown> | undefined;
          let workBody:
            | { query: { hybrid: { queries: unknown[] } } }
            | undefined;
          server.use(
            http.post(
              "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
              async ({ request }) => {
                fileSetBody = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({
                  hits: {
                    hits: [
                      {
                        _id: "file-set-1",
                        _score: 0.8,
                        _source: {
                          id: "file-set-1",
                          work_id: workId,
                          label: "Page 437",
                        },
                      },
                    ],
                  },
                });
              },
            ),
            http.post(
              "https://index.test.library.northwestern.edu/dc-v2-work/_search",
              async ({ request }) => {
                workBody = (await request.json()) as typeof workBody;
                return HttpResponse.json(
                  JSON.parse(testFixture("mocks/search.json")),
                );
              },
            ),
          );

          const result = await sendRequest(
            buildRequest("POST", "/search", { body: multimodalQuery }),
          );
          expect(result.status).toEqual(200);
          expect(fileSetBody?.collapse).toEqual({ field: "work_id" });

          expect(workBody!.query.hybrid.queries[1]).toEqual({
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      {
                        constant_score: {
                          filter: { ids: { values: [workId] } },
                          boost: 0.8,
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
              filter: [
                { terms: { published: [true] } },
                { terms: { visibility: ["Institution", "Public"] } },
              ],
            },
          });

          const body = await result.json();
          const work = body.data.find(
            (item: { id: string }) => item.id === workId,
          );
          expect(work.matched_file_sets).toEqual([
            { id: "file-set-1", label: "Page 437", score: 0.8 },
          ]);

          // Following the pagination URL repeats the request as it was sent.
          const token = new URL(body.pagination.query_url).searchParams.get(
            "searchToken",
          );
          const { body: tokenBody } = await decodeSearchToken(token!);
          expect(tokenBody).toMatchObject(multimodalQuery);
        });

        it("responds 400 to a clause without a query", async () => {
          const result = await sendRequest(
            buildRequest("POST", "/search", {
              body: { query: { has_file_set: { size: 10 } } },
            }),
          );
          expect(result.status).toEqual(400);
          expect((await result.json()).message).toContain("has_file_set");
        });

        it("responds 502 when the file set search fails", async () => {
          server.use(
            http.post(
              "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
              () => HttpResponse.json({}, { status: 500 }),
            ),
          );
          const result = await sendRequest(
            buildRequest("POST", "/search", { body: multimodalQuery }),
          );
          expect(result.status).toEqual(502);
        });
      });

      it("responds 503 without searching when the text cannot be embedded", async () => {
        setEmbeddingClient({
          send: async () => {
            throw new Error("throttled");
          },
        } as never);

        const result = await sendRequest(
          buildRequest("POST", "/search", { body: neuralQuery }),
        );
        expect(result.status).toEqual(503);
        expect((await result.json()).message).toEqual(
          "Semantic search is temporarily unavailable",
        );
      });
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
      expect(result).toHaveResponseFormat("opensearch");
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
      expect(result).toHaveResponseFormat("opensearch");

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
      expect(result).toHaveResponseFormat("opensearch");
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
      expect(result).toHaveResponseFormat("opensearch");
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
      expect(result).toHaveResponseFormat("iiif");
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
