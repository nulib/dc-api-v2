import sortJson from "sort-json";
import { defaultSearchSize } from "../../environment.ts";
import type { ApiToken } from "../api-token.ts";
import { embedQuery, type Embedder } from "../embeddings.ts";

interface NeuralField extends Record<string, unknown> {
  query_text: string;
}

type Clause = Record<string, unknown>;

/** The query clause that joins works to their matching file sets. */
const FILE_SET_JOIN = "has_file_set";
const DEFAULT_JOIN_SIZE = 100;
const MAX_JOIN_SIZE = 500;
const MATCH_SOURCE = [
  "id",
  "work_id",
  "label",
  "rank",
  "role",
  "representative_image_url",
  "width",
  "height",
];

/** Runs a search body against the file set index. */
export type FileSetSearcher = (
  body: string,
) => Promise<{ status: number; body: string }>;

/** The best matching file set of a work, as attached to the work's hit. */
export interface FileSetMatch extends Record<string, unknown> {
  id: string;
  score: number;
}

/** A query this API cannot make sense of; the client's mistake. */
export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueryError";
  }
}

/** The file set half of a `has_file_set` join failed in the search index. */
export class FileSetSearchError extends Error {
  status: number;

  constructor(status: number) {
    super(`File set search failed with status ${status}`);
    this.name = "FileSetSearchError";
    this.status = status;
  }
}

/**
 * Every clause under `node` that has `key`, at any depth. Matching clauses
 * are not searched further: what is under `key` belongs to that clause.
 */
function collectClauses(
  node: unknown,
  key: string,
  matches: (value: unknown) => boolean = () => true,
): Clause[] {
  if (Array.isArray(node))
    return node.flatMap((item) => collectClauses(item, key, matches));
  if (typeof node !== "object" || node === null) return [];

  const clause = node as Clause;
  const found = key in clause && matches(clause[key]) ? [clause] : [];
  return found.concat(
    Object.entries(clause).flatMap(([name, value]) =>
      name === key ? [] : collectClauses(value, key, matches),
    ),
  );
}

function parseFileSetJoin(join: unknown): { query: Clause; size: number } {
  const { query, size = DEFAULT_JOIN_SIZE } = (join ?? {}) as {
    query?: unknown;
    size?: unknown;
  };

  if (typeof query !== "object" || query === null || Array.isArray(query))
    throw new InvalidQueryError(`\`${FILE_SET_JOIN}\` requires a \`query\``);
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_JOIN_SIZE
  )
    throw new InvalidQueryError(
      `\`${FILE_SET_JOIN}.size\` must be an integer from 1 to ${MAX_JOIN_SIZE}`,
    );

  return { query: query as Clause, size };
}

interface ScoredHit {
  _score?: number | null;
  _source?: Record<string, unknown>;
}

/**
 * The works query a set of file set hits stands for: each work matches with
 * the score of its file set. Boosts cannot be negative.
 */
function worksMatching(hits: ScoredHit[]): Clause {
  const should = hits
    .filter((hit) => typeof hit._source?.work_id === "string")
    .map((hit) => ({
      constant_score: {
        filter: { ids: { values: [hit._source!.work_id] } },
        boost: Math.max(hit._score ?? 0, 0),
      },
    }));

  return should.length === 0
    ? { match_none: {} }
    : { bool: { should, minimum_should_match: 1 } };
}

function isTextNeuralQuery(neural: unknown): boolean {
  if (typeof neural !== "object" || neural === null) return false;
  const fields = Object.values(neural as Record<string, unknown>);
  return (
    fields.length === 1 &&
    typeof (fields[0] as NeuralField | null)?.query_text === "string"
  );
}

function filterFor(
  userToken: ApiToken,
  searchParams: URLSearchParams,
): Record<string, unknown>[] {
  const publishedValues = userToken.can("read:Unpublished")
    ? [true, false]
    : [true];
  const userVisibility = new Set(
    userToken.can("read:Private")
      ? ["Private", "Institution", "Public"]
      : ["Institution", "Public"],
  );
  const requestVisibility = searchParams
    .get("visibility")
    ?.split(",")
    ?.map((v) => v[0].toUpperCase() + v.slice(1)) ?? [
    "Private",
    "Institution",
    "Public",
  ];
  const visibilityValues = requestVisibility.filter((v) =>
    userVisibility.has(v),
  );

  return [
    { terms: { published: publishedValues } },
    { terms: { visibility: visibilityValues } },
  ];
}

function addFilter(
  query: Record<string, unknown>,
  filter: Record<string, unknown>[],
): Record<string, unknown> {
  let result: Record<string, unknown> = { ...query };
  if (result.bool) {
    (result.bool as Record<string, unknown>).filter ||= [];
    ((result.bool as Record<string, unknown>).filter as unknown[]).push(
      ...filter,
    );
  } else if (result.neural) {
    const boolFilter: Record<string, unknown> = { bool: { filter: filter } };
    const neuralField = Object.keys(
      result.neural as Record<string, unknown>,
    )[0];
    const neuralFieldObj = (
      result.neural as Record<string, Record<string, unknown>>
    )[neuralField];
    if (neuralFieldObj.filter) {
      ((boolFilter.bool as Record<string, unknown>).filter as unknown[]).push(
        neuralFieldObj.filter,
      );
    }
    neuralFieldObj.filter = boolFilter;
  } else if (result.hybrid) {
    (result.hybrid as Record<string, unknown>).queries = (
      result.hybrid as Record<string, unknown[]>
    ).queries.map((subQuery) =>
      addFilter(subQuery as Record<string, unknown>, filter),
    );
  } else {
    result = { bool: { must: [result], filter: filter } };
  }
  return result;
}

export default class RequestPipeline {
  searchContext: Record<string, unknown>;
  /** The auth filter applied to this search, for the searches it spawns. */
  filter: Record<string, unknown>[] = [];
  /** File sets found by `has_file_set` clauses, by work id. */
  fileSetMatches = new Map<string, FileSetMatch[]>();

  constructor(searchContext: Record<string, unknown>) {
    this.searchContext = { ...searchContext };
    if (this.searchContext.size === undefined)
      this.searchContext.size = defaultSearchSize();
    if (!this.searchContext.from) this.searchContext.from = 0;
  }

  authFilter(userToken: ApiToken, searchParams: URLSearchParams): this {
    this.filter = filterFor(userToken, searchParams);
    this.searchContext.query = addFilter(
      this.searchContext.query as Record<string, unknown>,
      structuredClone(this.filter),
    );
    this.searchContext.track_total_hits = true;
    return this;
  }

  /**
   * Resolve every `has_file_set` clause into a query for the works whose
   * file sets match.
   *
   *     { "has_file_set": { "query": { ... }, "size": 100 } }
   *
   * Like OpenSearch's `has_child`, but works and file sets live in separate
   * indexes, so the join happens here: `query` runs against the file set
   * index (under this search's auth filter), keeping the best file set of
   * each of the top `size` works, and the clause becomes a query matching
   * those works, each scored as its best file set. That makes file set
   * evidence, such as image embeddings, usable as one sub-query of a works
   * `hybrid` query, where it is normalized and weighted on its own.
   *
   * Call after `authFilter` and before `embedNeuralQueries`. The file sets
   * found are kept in `fileSetMatches`; see `withFileSetMatches`.
   */
  async joinFileSets(
    searcher: FileSetSearcher,
    embedder: Embedder = embedQuery,
  ): Promise<this> {
    const clauses = collectClauses(
      this.searchContext.query,
      FILE_SET_JOIN,
      (join) => typeof join === "object" && join !== null,
    );

    await Promise.all(
      clauses.map(async (clause) => {
        const { query, size } = parseFileSetJoin(clause[FILE_SET_JOIN]);

        const fileSets = new RequestPipeline({
          query: addFilter(
            structuredClone(query),
            structuredClone(this.filter),
          ),
          size,
          _source: MATCH_SOURCE,
          collapse: { field: "work_id" },
        });
        await fileSets.embedNeuralQueries(embedder);

        const response = await searcher(JSON.stringify(fileSets.searchContext));
        if (response.status !== 200)
          throw new FileSetSearchError(response.status);

        const hits = ((
          JSON.parse(response.body) as { hits?: { hits?: unknown } }
        ).hits?.hits ?? []) as ScoredHit[];
        hits.forEach((hit) => this.rememberFileSetMatch(hit));

        delete clause[FILE_SET_JOIN];
        Object.assign(clause, worksMatching(hits));
      }),
    );

    return this;
  }

  private rememberFileSetMatch(hit: ScoredHit): void {
    const { work_id: workId, ...fileSet } = hit._source ?? {};
    if (typeof workId !== "string" || typeof fileSet.id !== "string") return;

    const matches = this.fileSetMatches.get(workId) ?? [];
    if (matches.some((match) => match.id === fileSet.id)) return;
    matches.push({ ...fileSet, score: hit._score ?? 0 } as FileSetMatch);
    this.fileSetMatches.set(workId, matches);
  }

  /**
   * Add `matched_file_sets` to each work hit that a `has_file_set` clause
   * matched, so clients can show the file set that brought the work up.
   */
  withFileSetMatches(response: { status: number; body: string }): {
    status: number;
    body: string;
  } {
    if (response.status !== 200 || this.fileSetMatches.size === 0)
      return response;

    const body = JSON.parse(response.body) as {
      hits?: { hits?: { _id: string; _source?: Record<string, unknown> }[] };
    };
    for (const hit of body.hits?.hits ?? []) {
      const matches = this.fileSetMatches.get(hit._id);
      if (matches && hit._source) hit._source.matched_file_sets = matches;
    }
    return { ...response, body: JSON.stringify(body) };
  }

  /**
   * Replace every `neural` query with the equivalent `knn` query.
   *
   * The index stores precomputed document vectors and has no model to embed
   * `query_text` with, so the text is embedded here. Everything else about
   * the clause (`k`, `filter`, `boost`, ...) carries over unchanged, which
   * keeps existing clients and hybrid search pipelines working.
   */
  async embedNeuralQueries(embedder: Embedder = embedQuery): Promise<this> {
    const clauses = collectClauses(
      this.searchContext.query,
      "neural",
      isTextNeuralQuery,
    );

    await Promise.all(
      clauses.map(async (clause) => {
        const neural = clause.neural as Record<string, NeuralField>;
        const [field] = Object.keys(neural);
        const {
          query_text: queryText,
          model_id: _modelId,
          ...rest
        } = neural[field];

        delete clause.neural;
        clause.knn = {
          [field]: { ...rest, vector: await embedder(queryText) },
        };
      }),
    );

    return this;
  }

  addCardinality(): this {
    if ((this.searchContext as { collapse?: { field: string } }).collapse) {
      (this.searchContext.aggs as Record<string, unknown> | undefined) ||= {};
      (this.searchContext.aggs as Record<string, unknown>).__pagination = {
        cardinality: {
          field: (this.searchContext as { collapse: { field: string } })
            .collapse.field,
        },
      };
    }
    return this;
  }

  toJson(): string {
    this.addCardinality();
    return JSON.stringify(sortJson(this.searchContext));
  }
}
