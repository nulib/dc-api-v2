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

  describe("addNeuralModelId", () => {
    beforeEach(() => {
      process.env["OPENSEARCH_MODEL_ID"] = "MODEL_ID";
      requestBody.query = {
        neural: {
          embedding: {
            query_text:
              "Do you have any materials related to testing the request pipeline?",
            k: 5,
          },
        },
      };
      pipeline = new RequestPipeline(requestBody);
    });

    afterEach(() => {
      delete process.env["OPENSEARCH_MODEL_ID"];
    });

    it("does not modify the query if OPENSEARCH_MODEL_ID is not set", () => {
      delete process.env["OPENSEARCH_MODEL_ID"];
      pipeline.addNeuralModelId();
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("does not modify the query if there are no neural queries", () => {
      requestBody.query = {
        term: {
          all_titles: "request pipeline testing",
        },
      };
      pipeline = new RequestPipeline(requestBody);
      pipeline.addNeuralModelId();
      expect(pipeline.searchContext.query).toEqual(requestBody.query);
    });

    it("does not modify the query if there is already a model_id", () => {
      (requestBody.query as Record<string, unknown>).neural = {
        embedding: {
          ...((
            (requestBody.query as Record<string, unknown>).neural as Record<
              string,
              unknown
            >
          ).embedding as Record<string, unknown>),
          model_id: "EXISTING_MODEL_ID",
        },
      };
      pipeline = new RequestPipeline(requestBody);
      pipeline.addNeuralModelId();
      const neural = (pipeline.searchContext.query as Record<string, unknown>)
        .neural as Record<string, unknown>;
      const embedding = neural.embedding as Record<string, unknown>;
      expect(embedding.model_id).toEqual("EXISTING_MODEL_ID");
    });

    it("automatically adds the model_id to a neural query", () => {
      pipeline.addNeuralModelId();
      const neural = (pipeline.searchContext.query as Record<string, unknown>)
        .neural as Record<string, unknown>;
      const embedding = neural.embedding as Record<string, unknown>;
      expect(embedding.model_id).toEqual("MODEL_ID");
    });

    it("recursively adds the model_id to all neural queries in a hybrid query", () => {
      requestBody.query = {
        hybrid: {
          queries: [
            {
              neural: {
                embedding: {
                  query_text:
                    "Do you have any materials related to testing the request pipeline?",
                  k: 5,
                },
              },
            },
            {
              term: {
                all_titles: "request pipeline testing",
              },
            },
          ],
        },
      };
      pipeline = new RequestPipeline(requestBody);
      pipeline.addNeuralModelId();

      const hybrid = (pipeline.searchContext.query as Record<string, unknown>)
        .hybrid as Record<string, unknown>;
      const queries = hybrid.queries as Record<string, unknown>[];
      const neural = queries[0].neural as Record<string, unknown>;
      const embedding = neural.embedding as Record<string, unknown>;
      expect(embedding.model_id).toEqual("MODEL_ID");
    });
  });
});
