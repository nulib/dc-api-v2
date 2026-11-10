import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { ApiToken } from "../../../../src/api/api-token.ts";
import RequestPipeline from "../../../../src/api/request/pipeline.ts";
import { setupEnv, teardownEnv } from "../../../test-helpers/index.ts";

describe("RequestPipeline", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  let pipeline: RequestPipeline;
  let requestBody: Record<string, unknown>;

  beforeEach(() => {
    requestBody = {
      query: { match: { term: { title: "The Title" } } },
      size: 50,
      from: 0,
      sort: [{ create_date: "asc" }],
      _source: ["id", "title", "collection"],
      aggs: { collection: { terms: { field: "contributor.label", size: 10 } } },
    };
    pipeline = new RequestPipeline(requestBody);
  });

  it("adds an auth filter", () => {
    const userToken = new ApiToken();
    const result = pipeline.authFilter(userToken, new URLSearchParams());
    expect(result.searchContext.size).toEqual(50);

    const query = result.searchContext.query as Record<string, unknown>;
    const bool = query.bool as Record<string, unknown>;
    const must = bool.must as unknown[];
    expect(
      must.some((m) => JSON.stringify(m) === JSON.stringify(requestBody.query)),
    ).toBe(true);

    const filter = bool.filter as unknown[];
    expect(
      filter.some(
        (f) =>
          JSON.stringify(f) ===
          JSON.stringify({ terms: { visibility: ["Institution", "Public"] } }),
      ),
    ).toBe(true);
    expect(
      filter.some(
        (f) =>
          JSON.stringify(f) ===
          JSON.stringify({ terms: { published: [true] } }),
      ),
    ).toBe(true);
  });

  it("serializes JSON", () => {
    expect(JSON.parse(pipeline.toJson())).toEqual(requestBody);
  });

  describe("reading room user", () => {
    it("filters out private results by default", () => {
      const userToken = new ApiToken();
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const filter = (result.searchContext.query as Record<string, unknown>)
        .bool as Record<string, unknown>;
      const filterArr = filter.filter as unknown[];
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Institution", "Public"] },
            }),
        ),
      ).toBe(true);
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({ terms: { published: [true] } }),
        ),
      ).toBe(true);
    });

    it("includes private results if the user is in the reading room", () => {
      const userToken = new ApiToken().readingRoom();
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const filter = (result.searchContext.query as Record<string, unknown>)
        .bool as Record<string, unknown>;
      const filterArr = filter.filter as unknown[];
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({ terms: { published: [true] } }),
        ),
      ).toBe(true);
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Private", "Institution", "Public"] },
            }),
        ),
      ).toBe(true);
    });
  });

  describe("superuser", () => {
    it("filters out private results by default", () => {
      const userToken = new ApiToken();
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const filter = (result.searchContext.query as Record<string, unknown>)
        .bool as Record<string, unknown>;
      const filterArr = filter.filter as unknown[];
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Institution", "Public"] },
            }),
        ),
      ).toBe(true);
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({ terms: { published: [true] } }),
        ),
      ).toBe(true);
    });

    it("includes private results if the user is a superuser", () => {
      const userToken = new ApiToken().superUser();
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const filter = (result.searchContext.query as Record<string, unknown>)
        .bool as Record<string, unknown>;
      const filterArr = filter.filter as unknown[];
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({ terms: { published: [true, false] } }),
        ),
      ).toBe(true);
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Private", "Institution", "Public"] },
            }),
        ),
      ).toBe(true);
    });
  });

  describe("neural", () => {
    it("applies the filter to a neural query", () => {
      const userToken = new ApiToken();
      requestBody.query = {
        neural: {
          embedding: {
            query_text:
              "Do you have any materials related to testing the request pipeline?",
            model_id: "MODEL_ID",
            k: 5,
          },
        },
      };
      pipeline = new RequestPipeline(requestBody);
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const neural = (result.searchContext.query as Record<string, unknown>)
        .neural as Record<string, unknown>;
      const embedding = neural.embedding as Record<string, unknown>;
      const neuralFilter = embedding.filter as Record<string, unknown>;
      const filterArr = (neuralFilter.bool as Record<string, unknown>)
        .filter as unknown[];
      expect(filterArr.length).toEqual(2);
    });

    it("adds to an existing neural query filter", () => {
      const userToken = new ApiToken();
      requestBody.query = {
        neural: {
          embedding: {
            filter: {
              term: { "visibility.keyword": "Public" },
            },
            query_text:
              "Do you have any materials related to testing the request pipeline?",
            model_id: "MODEL_ID",
            k: 5,
          },
        },
      };
      pipeline = new RequestPipeline(requestBody);
      const result = pipeline.authFilter(userToken, new URLSearchParams());
      expect(result.searchContext.size).toEqual(50);

      const neural = (result.searchContext.query as Record<string, unknown>)
        .neural as Record<string, unknown>;
      const embedding = neural.embedding as Record<string, unknown>;
      const neuralFilter = embedding.filter as Record<string, unknown>;
      const filterArr = (neuralFilter.bool as Record<string, unknown>)
        .filter as unknown[];
      expect(filterArr.length).toEqual(3);
    });
  });

  describe("hybrid", () => {
    it("applies the filter to all subqueries", () => {
      const userToken = new ApiToken();
      requestBody.query = {
        hybrid: {
          queries: [
            {
              neural: {
                embedding: {
                  query_text:
                    "Do you have any materials related to testing the request pipeline?",
                  model_id: "MODEL_ID",
                  k: 5,
                },
              },
            },
            {
              match: {
                all_titles: {
                  query:
                    "Do you have any materials related to testing the request pipeline?",
                  operator: "AND",
                  analyzer: "english",
                },
              },
            },
          ],
        },
      };
      pipeline = new RequestPipeline(requestBody);
      const result = pipeline.authFilter(userToken, new URLSearchParams());

      const hybrid = (result.searchContext.query as Record<string, unknown>)
        .hybrid as Record<string, unknown>;
      const [newNeuralQuery, newMatchQuery] = hybrid.queries as Record<
        string,
        unknown
      >[];

      const embedding = (newNeuralQuery.neural as Record<string, unknown>)
        .embedding as Record<string, unknown>;
      expect(embedding !== undefined && embedding !== null).toBe(true);

      const neuralFilter = embedding.filter as Record<string, unknown>;
      const filterArr = (neuralFilter.bool as Record<string, unknown>)
        .filter as unknown[];
      expect(
        filterArr.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Institution", "Public"] },
            }),
        ),
      ).toBe(true);

      const matchBool = newMatchQuery.bool as Record<string, unknown>;
      const matchFilter = matchBool.filter as unknown[];
      expect(
        matchFilter.some(
          (f) =>
            JSON.stringify(f) ===
            JSON.stringify({
              terms: { visibility: ["Institution", "Public"] },
            }),
        ),
      ).toBe(true);
    });
  });

  describe("embedNeuralQueries", () => {
    const queryText =
      "Do you have any materials related to testing the request pipeline?";
    const vector = [0.1, 0.2, 0.3];
    let embedded: string[];
    const embedder = async (text: string) => {
      embedded.push(text);
      return vector;
    };

    beforeEach(() => {
      embedded = [];
      requestBody.query = {
        neural: { embedding: { query_text: queryText, k: 5 } },
      };
      pipeline = new RequestPipeline(requestBody);
    });

    it("replaces a neural query with a knn query on the embedded text", async () => {
      await pipeline.embedNeuralQueries(embedder);
      expect(embedded).toEqual([queryText]);
      expect(pipeline.searchContext.query).toEqual({
        knn: { embedding: { vector, k: 5 } },
      });
    });

    it("drops the model id and keeps every other option", async () => {
      requestBody.query = {
        neural: {
          embedding: {
            query_text: queryText,
            model_id: "MODEL_ID",
            k: 5,
            boost: 2,
            filter: { term: { work_type: "Image" } },
          },
        },
      };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.embedNeuralQueries(embedder);
      expect(pipeline.searchContext.query).toEqual({
        knn: {
          embedding: {
            vector,
            k: 5,
            boost: 2,
            filter: { term: { work_type: "Image" } },
          },
        },
      });
    });

    it("keeps the auth filter inside the knn query", async () => {
      pipeline.authFilter(new ApiToken(), new URLSearchParams());
      await pipeline.embedNeuralQueries(embedder);

      const query = pipeline.searchContext.query as Record<string, unknown>;
      expect(query.neural).toBeUndefined();
      const knn = (query.knn as Record<string, Record<string, unknown>>)
        .embedding;
      expect(knn.vector).toEqual(vector);
      expect(knn.filter).toEqual({
        bool: {
          filter: [
            { terms: { published: [true] } },
            { terms: { visibility: ["Institution", "Public"] } },
          ],
        },
      });
    });

    it("rewrites neural queries nested in hybrid and bool queries", async () => {
      requestBody.query = {
        hybrid: {
          queries: [
            { match: { all_titles: { query: "pipeline" } } },
            {
              bool: {
                must: [{ neural: { embedding: { query_text: "one", k: 5 } } }],
                filter: [{ term: { published: true } }],
              },
            },
            { neural: { embedding: { query_text: "two", k: 10 } } },
          ],
        },
      };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.embedNeuralQueries(embedder);

      expect(embedded.sort()).toEqual(["one", "two"]);
      expect(pipeline.searchContext.query).toEqual({
        hybrid: {
          queries: [
            { match: { all_titles: { query: "pipeline" } } },
            {
              bool: {
                must: [{ knn: { embedding: { vector, k: 5 } } }],
                filter: [{ term: { published: true } }],
              },
            },
            { knn: { embedding: { vector, k: 10 } } },
          ],
        },
      });
    });

    it("does not call the embedder when there are no neural queries", async () => {
      requestBody.query = { term: { all_titles: "request pipeline testing" } };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.embedNeuralQueries(embedder);
      expect(embedded).toEqual([]);
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("leaves a field that happens to be named neural alone", async () => {
      requestBody.query = { term: { neural: "networks" } };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.embedNeuralQueries(embedder);
      expect(embedded).toEqual([]);
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("leaves neural queries without query text alone", async () => {
      requestBody.query = {
        neural: { embedding: { query_image: "base64", k: 5 } },
      };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.embedNeuralQueries(embedder);
      expect(embedded).toEqual([]);
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("propagates embedding failures", async () => {
      const failing = async () => {
        throw new Error("no embedding");
      };
      expect(pipeline.embedNeuralQueries(failing)).rejects.toThrow(
        "no embedding",
      );
    });
  });

  describe("joinFileSets", () => {
    const vector = [0.1, 0.2, 0.3];
    const embedder = async () => vector;
    const hit = (id: string, workId: string, score: number) => ({
      _id: id,
      _score: score,
      _source: { id, work_id: workId, label: `Page ${id}` },
    });

    let searched: Record<string, unknown>[];
    let hits: unknown[];
    let status: number;
    const searcher = async (body: string) => {
      searched.push(JSON.parse(body));
      return { status, body: JSON.stringify({ hits: { hits } }) };
    };

    const join = {
      has_file_set: {
        query: { neural: { embedding: { query_text: "a red barn", k: 500 } } },
        size: 25,
      },
    };

    beforeEach(() => {
      searched = [];
      status = 200;
      hits = [hit("fs-1", "work-1", 0.9), hit("fs-2", "work-2", 0.7)];
      requestBody.query = structuredClone(join);
      pipeline = new RequestPipeline(requestBody);
    });

    it("searches file sets, one per work, under the auth filter", async () => {
      pipeline.authFilter(new ApiToken(), new URLSearchParams());
      await pipeline.joinFileSets(searcher, embedder);

      expect(searched).toHaveLength(1);
      expect(searched[0].size).toEqual(25);
      expect(searched[0].collapse).toEqual({ field: "work_id" });
      expect(searched[0].query).toEqual({
        knn: {
          embedding: {
            vector,
            k: 500,
            filter: {
              bool: {
                filter: [
                  { terms: { published: [true] } },
                  { terms: { visibility: ["Institution", "Public"] } },
                ],
              },
            },
          },
        },
      });
    });

    it("replaces the clause with the matching works, scored by file set", async () => {
      await pipeline.joinFileSets(searcher, embedder);

      expect(pipeline.searchContext.query).toEqual({
        bool: {
          should: [
            {
              constant_score: {
                filter: { ids: { values: ["work-1"] } },
                boost: 0.9,
              },
            },
            {
              constant_score: {
                filter: { ids: { values: ["work-2"] } },
                boost: 0.7,
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    });

    it("resolves a clause inside a hybrid query and keeps its filters", async () => {
      requestBody.query = {
        hybrid: {
          queries: [
            { match: { title: "barn" } },
            {
              bool: {
                must: [structuredClone(join)],
                filter: [{ term: { work_type: "Image" } }],
              },
            },
          ],
        },
      };
      pipeline = new RequestPipeline(requestBody);
      pipeline.authFilter(new ApiToken(), new URLSearchParams());
      await pipeline.joinFileSets(searcher, embedder);

      const queries = (
        pipeline.searchContext.query as {
          hybrid: { queries: { bool: Record<string, unknown[]> }[] };
        }
      ).hybrid.queries;
      const joined = queries[1].bool;
      expect(Object.keys(joined.must[0] as object)).toEqual(["bool"]);
      expect(joined.filter).toEqual([
        { term: { work_type: "Image" } },
        { terms: { published: [true] } },
        { terms: { visibility: ["Institution", "Public"] } },
      ]);
    });

    it("matches nothing when no file sets match", async () => {
      hits = [];
      await pipeline.joinFileSets(searcher, embedder);
      expect(pipeline.searchContext.query).toEqual({ match_none: {} });
    });

    it("uses the default size", async () => {
      requestBody.query = { has_file_set: { query: { match_all: {} } } };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.joinFileSets(searcher, embedder);
      expect(searched[0].size).toEqual(100);
    });

    it("does nothing without a has_file_set clause", async () => {
      requestBody.query = { term: { has_file_set: "a field value" } };
      pipeline = new RequestPipeline(requestBody);
      await pipeline.joinFileSets(searcher, embedder);
      expect(searched).toEqual([]);
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("rejects a clause without a query or with a bad size", async () => {
      requestBody.query = { has_file_set: { size: 10 } };
      await expect(
        new RequestPipeline(requestBody).joinFileSets(searcher, embedder),
      ).rejects.toThrow("requires a `query`");

      requestBody.query = {
        has_file_set: { query: { match_all: {} }, size: 501 },
      };
      await expect(
        new RequestPipeline(requestBody).joinFileSets(searcher, embedder),
      ).rejects.toThrow("must be an integer from 1 to 500");
    });

    it("fails when the file set search fails", async () => {
      status = 400;
      await expect(pipeline.joinFileSets(searcher, embedder)).rejects.toThrow(
        "File set search failed with status 400",
      );
    });

    it("adds the matched file sets to the hits for their works", async () => {
      await pipeline.joinFileSets(searcher, embedder);
      const response = pipeline.withFileSetMatches({
        status: 200,
        body: JSON.stringify({
          hits: {
            hits: [
              { _id: "work-2", _source: { id: "work-2" } },
              { _id: "work-3", _source: { id: "work-3" } },
            ],
          },
        }),
      });

      expect(JSON.parse(response.body).hits.hits).toEqual([
        {
          _id: "work-2",
          _source: {
            id: "work-2",
            matched_file_sets: [{ id: "fs-2", label: "Page fs-2", score: 0.7 }],
          },
        },
        { _id: "work-3", _source: { id: "work-3" } },
      ]);
    });

    it("leaves responses alone when nothing was joined", () => {
      const response = { status: 200, body: "{}" };
      expect(pipeline.withFileSetMatches(response)).toBe(response);
    });
  });
});
