import { baseUrl, effectivePath, errorMessage } from "../helpers.ts";
import {
  extractRequestedModels,
  modelsToTargets,
  validModels,
} from "../api/request/models.ts";
import { search } from "../api/opensearch.ts";
import { transformSearchResult } from "../api/response/transformer.ts";
import { decodeSearchToken, Paginator } from "../api/pagination.ts";
import type { OpenSearchSearchResponse } from "../api/opensearch-types.ts";
import RequestPipeline from "../api/request/pipeline.ts";
import { defaultSearchSize } from "../environment.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import { cloneRawRequest } from "hono/request";

const AllowedQueryParams = ["search_pipeline"];

export interface SearchOptions {
  includeToken?: boolean;
  // Params used when generating pagination URLs (defaults to effective search params)
  parameterOverrides?: Record<string, string>;
  // Additional/override query params layered on top of the URL search params
  queryOverrides?: Record<string, string>;
  // Pre-constructed body; bypasses query-string body construction
  bodyOverride?: Record<string, unknown>;
  // Override the {models} path param
  modelOverride?: string;
  defaultSort?: unknown;
}

const sanitizeQueryString = (
  params: URLSearchParams,
): Record<string, string> | undefined => {
  const sanitized: Record<string, string> = {};
  for (const param of AllowedQueryParams) {
    const val = params.get(param);
    if (val !== null) sanitized[param] = val;
  }
  return Object.keys(sanitized).length === 0 ? undefined : sanitized;
};

export const doSearch = async (
  c: Context<AppEnv>,
  searchOptions: SearchOptions = {},
): Promise<Response> => {
  const url = new URL(c.req.url);

  // Merge URL search params with any caller-supplied overrides
  const effectiveParams = new URLSearchParams(url.searchParams);
  for (const [k, v] of Object.entries(searchOptions.queryOverrides ?? {})) {
    effectiveParams.set(k, v);
  }

  const models = extractRequestedModels(
    searchOptions.modelOverride ?? c.req.param("models"),
  );
  const format = await responseFormat(effectiveParams);

  let searchContext: Record<string, unknown>;
  try {
    searchContext = await constructSearchContext(
      c,
      effectiveParams,
      searchOptions,
    );
  } catch (error) {
    return new Response(JSON.stringify({ message: errorMessage(error) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!searchContext.sort && searchOptions.defaultSort) {
    searchContext.sort = searchOptions.defaultSort;
  }

  if (!validModels(models, format)) {
    return new Response(
      JSON.stringify({ message: `Invalid models requested: ${models}` }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const base = new URL(baseUrl(c));
  const path = effectivePath(c);

  const pager = new Paginator(
    base.toString(),
    path,
    models,
    searchContext,
    format,
    {
      ...searchOptions,
      queryStringParameters: Object.fromEntries(effectiveParams.entries()),
    },
  );

  const filteredSearchContext = new RequestPipeline(searchContext)
    .authFilter(c.get("userToken"), effectiveParams)
    .toJson();

  const searchModels = modelsToTargets(models);
  const searchQuery = sanitizeQueryString(effectiveParams);

  if (format === "_explain") {
    return new Response(
      JSON.stringify({
        models: searchModels,
        body: JSON.parse(filteredSearchContext),
        query: searchQuery,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const esResponse = await search(
    searchModels,
    filteredSearchContext,
    searchQuery,
  );
  if (pager.format === "kml" && esResponse.status === 200) {
    const fileSetResponse = await drillDownFileSets(esResponse);
    return transformSearchResult(fileSetResponse, pager);
  }
  return transformSearchResult(esResponse, pager);
};

const getFileSetIdsFromCollection = async ({
  id,
}: Record<string, unknown>): Promise<string[]> => {
  const query = {
    query: {
      term: {
        "collection.id": id,
      },
    },
    _source: ["id", "api_model", "file_sets.id"],
    size: 10000,
  };
  const response = await search(
    modelsToTargets(["works"]),
    JSON.stringify(query),
  );
  const responseBody = JSON.parse(
    (response as unknown as { status: number; body: string }).body,
  ) as OpenSearchSearchResponse<unknown>;
  if (!responseBody.hits?.hits) return [];
  return responseBody.hits.hits.flatMap((hit) => {
    const hitSource = hit._source as Record<string, unknown>;
    return getFileSetIdsFromWork(hitSource);
  });
};

const getFileSetIdsFromWork = (work: Record<string, unknown>): string[] => {
  if (!Array.isArray(work.file_sets)) return [];
  return work.file_sets.map(({ id }) => id);
};

const drillDownFileSets = async (response: {
  status: number;
  body: string;
}): Promise<{ status: number; body: string }> => {
  const responseBody = JSON.parse(
    response.body,
  ) as OpenSearchSearchResponse<unknown>;
  if (!responseBody.hits?.hits) return response;
  const fileSetIds = (
    await Promise.all(
      responseBody.hits.hits.flatMap(async (hit) => {
        const hitSource = hit._source as Record<string, unknown>;
        switch (hitSource.api_model) {
          case "FileSet":
            return [hitSource.id];
          case "Work":
            return getFileSetIdsFromWork(hitSource);
          case "Collection":
            return await getFileSetIdsFromCollection(hitSource);
          default:
            return [];
        }
      }),
    )
  ).flat();

  const query = {
    query: {
      terms: {
        id: fileSetIds,
      },
    },
    size: fileSetIds.length,
  };
  return search(modelsToTargets(["file-sets"]), JSON.stringify(query));
};

const constructSearchContext = async (
  c: Context<AppEnv>,
  effectiveParams: URLSearchParams,
  searchOptions: SearchOptions,
): Promise<Record<string, unknown>> => {
  let searchContext: Record<string, unknown>;

  if (searchOptions.bodyOverride) {
    searchContext = searchOptions.bodyOverride;
  } else if (c.req.method === "POST") {
    const clonedRequest = await cloneRawRequest(c.req);
    searchContext = (await clonedRequest.json()) as Record<string, unknown>;
  } else {
    const token = effectiveParams.get("searchToken");
    searchContext =
      token === undefined || token === null || token === ""
        ? fromQueryString(effectiveParams)
        : await fromToken(token);
  }

  const sizeParam = effectiveParams.get("size");
  if (sizeParam !== null) {
    searchContext.size = Number(sizeParam);
  } else if (searchContext.size === undefined) {
    searchContext.size = defaultSearchSize();
  }
  searchContext.from = effectiveParams.get("from") ?? searchContext.from ?? 0;

  const sourceExcludes = effectiveParams.get("_source_excludes");
  const sourceIncludes = effectiveParams.get("_source_includes");

  if (
    sourceExcludes ||
    (searchContext._source as Record<string, unknown>)?.exclude
  ) {
    searchContext._source =
      (searchContext._source as Record<string, unknown>) ?? {};
    (searchContext._source as Record<string, unknown>).exclude =
      sourceExcludes?.split(",") ??
      (searchContext._source as Record<string, unknown>).exclude;
  }

  if (
    sourceIncludes ||
    (searchContext._source as Record<string, unknown>)?.include
  ) {
    searchContext._source =
      (searchContext._source as Record<string, unknown>) ?? {};
    (searchContext._source as Record<string, unknown>).include =
      sourceIncludes?.split(",") ??
      (searchContext._source as Record<string, unknown>).include;
  }

  const sortParam = effectiveParams.get("sort");
  if (sortParam || searchContext.sort) {
    searchContext.sort = parseSortParameter(sortParam) ?? searchContext.sort;
  }

  const pageParam = effectiveParams.get("page");
  if (pageParam) {
    const page = Number(pageParam || 1);
    searchContext.from = (page - 1) * Number(searchContext.size);
  }

  return searchContext;
};

const fromQueryString = (params: URLSearchParams): Record<string, unknown> => ({
  query: {
    query_string: {
      query: params.get("query") ?? "*",
    },
  },
});

const parseSortParameter = (sortString: string | null): unknown[] | null => {
  if (sortString === null) return null;
  const values: Record<string, string>[] = [];
  for (const el of sortString.split(",")) {
    const obj: Record<string, string> = {};
    const [key, value] = el.split(":");
    obj[key] = value;
    values.push(obj);
  }
  return values;
};

const responseFormat = async (params: URLSearchParams): Promise<string> => {
  const as = params.get("as");
  if (as) return as;

  const token = params.get("searchToken");
  if (token === null) return "default";

  try {
    const request = await decodeSearchToken(token);
    return (request as { format: string }).format;
  } catch {
    return "default";
  }
};

const fromToken = async (token: string): Promise<Record<string, unknown>> => {
  try {
    const request = await decodeSearchToken(token);
    return (request as { body: Record<string, unknown> }).body;
  } catch {
    throw new Error("searchToken is invalid");
  }
};
