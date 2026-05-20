import { search } from "../../api/opensearch.ts";
import {
  extractRequestedModels,
  modelsToTargets,
} from "../../api/request/models.ts";

export async function earliestRecord(): Promise<string | undefined> {
  const body = {
    size: 1,
    _source: "create_date",
    query: {
      bool: {
        must: [
          { term: { api_model: "Work" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ create_date: "asc" }],
  };
  const esResponse = await search(
    modelsToTargets(extractRequestedModels(undefined)),
    JSON.stringify(body),
  );
  const responseBody = JSON.parse(esResponse.body);
  return responseBody?.hits?.hits[0]?._source?.create_date;
}

export async function oaiSearch(
  dates: { from?: string; until?: string },
  set?: string,
  size = 250,
): Promise<{ status: number; body: string; expiration: string }> {
  const range = {
    range: {
      modified_date: {
        ...(dates.from && { gt: dates.from }),
        ...(dates.until && { lt: dates.until }),
      },
    },
  };
  const query: Record<string, unknown> = {
    bool: {
      must: [
        { term: { api_model: "Work" } },
        { term: { published: true } },
        { term: { visibility: "Public" } },
        range,
      ],
    },
  };
  if (set)
    (query.bool as { must: unknown[] }).must.push({
      term: { "collection.id": set },
    });

  const body = {
    size,
    query,
    sort: [{ modified_date: "asc" }],
  };

  const esResponse = await search(
    modelsToTargets(extractRequestedModels(undefined)),
    JSON.stringify(body),
    { scroll: "2m" },
  );

  return {
    ...esResponse,
    expiration: new Date(new Date().getTime() + 2 * 60000).toISOString(),
  };
}

export async function oaiSets(): Promise<{ status: number; body: string }> {
  const body = {
    size: 10000,
    _source: ["id", "title"],
    query: {
      bool: {
        must: [
          { term: { api_model: "Collection" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ title: "asc" }],
  };

  return await search(modelsToTargets(["collections"]), JSON.stringify(body));
}
