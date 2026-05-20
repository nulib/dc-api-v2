import { HttpRequest } from "@smithy/protocol-http";
import { awsFetch } from "../aws/fetch.ts";
import { openSearchEndpoint, prefix } from "../environment.ts";
import Honeybadger from "@honeybadger-io/js";

export async function getCollection(
  id: string,
  opts?: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  return getDocument("dc-v2-collection", id, opts);
}

export async function getFileSet(
  id: string,
  opts?: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  return getDocument("dc-v2-file-set", id, opts);
}

export async function getWork(
  id: string,
  opts?: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  return getDocument("dc-v2-work", id, opts);
}

export async function getSharedLink(
  id: string,
  opts?: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  return getDocument("shared_links", id, opts);
}

export async function getWorkFileSets(
  workId: string,
  opts: {
    allowPrivate?: boolean;
    allowUnpublished?: boolean;
    annotationsQuery?: string | null;
    role?: string | null;
    source?: string[];
    sortBy?: string | null;
    sortOrder?: string;
  } = {},
): Promise<{ status: number; body: string }> {
  Honeybadger.addBreadcrumb("Retrieving work file sets", {
    metadata: { workId },
  });

  const {
    allowPrivate = false,
    allowUnpublished = false,
    annotationsQuery = null,
    role = null,
    source = null,
    sortBy = null,
    sortOrder = "asc",
  } = opts;

  const visibilityFilters: Record<string, unknown>[] = [];
  if (!allowPrivate) {
    visibilityFilters.push({
      bool: {
        should: [
          { term: { visibility: "Public" } },
          { term: { visibility: "Institution" } },
        ],
      },
    });
  }
  if (!allowUnpublished) {
    visibilityFilters.push({ term: { published: true } });
  }

  const mustClauses: Record<string, unknown>[] = [
    { term: { work_id: workId } },
  ];
  if (role) {
    mustClauses.push({ term: { role: role } });
  }
  if (annotationsQuery) {
    mustClauses.push({
      match_phrase: { "annotations.content": annotationsQuery },
    });
  }

  const searchBody: Record<string, unknown> = {
    size: 10000,
    query: { bool: { must: mustClauses, filter: visibilityFilters } },
  };

  if (sortBy) {
    searchBody.sort = [{ [sortBy]: { order: sortOrder } }];
  }

  if (source) {
    searchBody._source = source;
  }

  return await search(prefix("dc-v2-file-set"), JSON.stringify(searchBody));
}

async function getDocument(
  index: string,
  id: string,
  opts: { allowPrivate?: boolean; allowUnpublished?: boolean } = {},
): Promise<{ status: number; body: string }> {
  Honeybadger.addBreadcrumb("Retrieving document", { metadata: { index, id } });
  const request = initRequest(`/${prefix(index)}/_doc/${id}`);
  let response = await awsFetch(request);
  if (response.status === 200) {
    const body = JSON.parse(response.body);

    if (index !== "shared_links") {
      if (!body?.found) {
        response = {
          status: 404,
          body: JSON.stringify({
            _index: prefix(index),
            _type: "_doc",
            _id: id,
            found: false,
          }),
        };
      } else if (!isVisible(body, opts)) {
        response = body?._source.published
          ? { status: 403, body: "" }
          : {
              status: 404,
              body: JSON.stringify({
                _index: prefix(index),
                _type: "_doc",
                _id: id,
                found: false,
              }),
            };
      }
    }
  }

  return response;
}

function isVisible(
  doc: Record<string, unknown>,
  {
    allowPrivate,
    allowUnpublished,
  }: { allowPrivate?: boolean; allowUnpublished?: boolean },
): boolean {
  const source = doc?._source as Record<string, unknown>;
  const isAllowedVisibility = allowPrivate || source?.visibility !== "Private";
  const isAllowedPublished = allowUnpublished || source?.published;
  return !!isAllowedVisibility && !!isAllowedPublished;
}

function initRequest(path: string): HttpRequest {
  const endpoint = openSearchEndpoint();
  return new HttpRequest({
    method: "GET",
    hostname: endpoint,
    headers: { Host: endpoint, "Content-Type": "application/json" },
    path: path,
  });
}

export async function search(
  targets: string,
  body: string,
  optionsQuery: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  Honeybadger.addBreadcrumb("Searching", { metadata: { targets, body } });
  const endpoint = openSearchEndpoint();

  const request = new HttpRequest({
    method: "POST",
    hostname: endpoint,
    headers: { Host: endpoint, "Content-Type": "application/json" },
    body: body,
    path: `/${targets}/_search`,
    query: optionsQuery,
  });

  return await awsFetch(request);
}

export async function scroll(
  scrollId: string,
): Promise<{ status: number; body: string }> {
  const endpoint = openSearchEndpoint();
  const request = new HttpRequest({
    method: "POST",
    hostname: endpoint,
    headers: { Host: endpoint, "Content-Type": "application/json" },
    body: JSON.stringify({ scroll: "2m" }),
    path: `_search/scroll/${scrollId}`,
  });
  return await awsFetch(request);
}

export async function deleteScroll(
  scrollId: string,
): Promise<{ status: number; body: string }> {
  const endpoint = openSearchEndpoint();
  const request = new HttpRequest({
    method: "DELETE",
    hostname: endpoint,
    headers: { Host: endpoint, "Content-Type": "application/json" },
    path: `_search/scroll/${scrollId}`,
  });
  return await awsFetch(request);
}
