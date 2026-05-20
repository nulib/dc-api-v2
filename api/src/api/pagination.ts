import lzstring from "lz-string";
import { defaultSearchSize } from "../environment.ts";
import type { OpenSearchSearchResponse } from "./opensearch-types.ts";

const {
  decompressFromEncodedURIComponent: decompress,
  compressToEncodedURIComponent: compress,
} = lzstring as {
  decompressFromEncodedURIComponent: (s: string) => string;
  compressToEncodedURIComponent: (s: string) => string;
};

const encodeFields = [
  "query",
  "size",
  "sort",
  "fields",
  "collapse",
  "aggs",
  "_source",
];

export async function decodeSearchToken(
  token: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(await decompress(token));
}

export async function encodeSearchToken(
  models: string[],
  body: Record<string, unknown>,
  format: string,
  options: Record<string, unknown>,
): Promise<string> {
  const token: Record<string, unknown> = {
    body: { size: 10 },
    models,
    format,
    options,
  };
  for (const field in body) {
    if (encodeFields.includes(field)) {
      (token.body as Record<string, unknown>)[field] = body[field];
    }
  }
  if ((token.body as Record<string, unknown>).aggs) {
    const aggs = (token.body as Record<string, unknown>).aggs as Record<
      string,
      unknown
    >;
    if ("_pagination" in aggs) delete aggs._pagination;
  }
  return await compress(JSON.stringify(token));
}

function from(body: Record<string, unknown>): number {
  return (body?.from as number) || 0;
}

function size(body: Record<string, unknown>): number {
  return (body?.size as number) || defaultSearchSize();
}

function maxPage(body: Record<string, unknown>, count: number): number {
  return Math.ceil(count / size(body));
}

function nextPage(body: Record<string, unknown>, count: number): number | null {
  const current = thisPage(body);
  return maxPage(body, count) > current ? current + 1 : null;
}

function prevPage(body: Record<string, unknown>): number | null {
  return (body.from as number) > 0 ? thisPage(body) - 1 : null;
}

function thisPage(body: Record<string, unknown>): number {
  return Math.floor(from(body) / size(body) + 1);
}

export class Paginator {
  baseUrl: string;
  route: string;
  models: string[];
  body: Record<string, unknown>;
  format: string;
  options: Record<string, unknown>;

  constructor(
    baseUrl: string,
    route: string,
    models: string[],
    body: Record<string, unknown>,
    format: string,
    options: Record<string, unknown>,
  ) {
    this.baseUrl = baseUrl;
    this.route = route;
    this.models = models;
    this.body = { ...body };
    this.format = format;
    this.options = options;
  }

  async pageInfo(
    count: number,
    opts: { includeOptions?: boolean; aggregatedCount?: number } = {},
  ): Promise<Record<string, unknown>> {
    const url = new URL(this.route, this.baseUrl);
    let searchToken: string | undefined;

    const includeToken =
      (this.options as { includeToken?: boolean })?.includeToken !== false;
    if (includeToken) {
      const overrides = this.options as {
        parameterOverrides?: { searchToken?: string };
        queryStringParameters?: { searchToken?: string };
      };
      searchToken =
        overrides?.parameterOverrides?.searchToken ||
        overrides?.queryStringParameters?.searchToken ||
        (await encodeSearchToken(
          this.models,
          this.body,
          this.format,
          this.options,
        ));

      url.searchParams.set("searchToken", searchToken);
    }

    const queryStringParameters =
      (this.options as { parameterOverrides?: Record<string, string> })
        ?.parameterOverrides ||
      (this.options as { queryStringParameters?: Record<string, string> })
        ?.queryStringParameters ||
      {};
    if (typeof queryStringParameters === "object") {
      for (const param in queryStringParameters) {
        url.searchParams.set(
          param,
          (queryStringParameters as Record<string, string>)[param],
        );
      }
    }

    const aggregatedCount =
      (opts as { aggregatedCount?: number })?.aggregatedCount ?? count;
    const prev = prevPage(this.body);
    const next = nextPage(this.body, aggregatedCount);
    url.searchParams.delete("from");

    const result: Record<string, unknown> = {
      query_url: url.toString(),
      current_page: thisPage(this.body),
      limit: size(this.body),
      offset: from(this.body),
      total_hits: count,
      total_pages: maxPage(this.body, aggregatedCount),
      format: this.format,
    };
    if ((this.body as { collapse?: { field: string } }).collapse) {
      result.collapsed_by = {
        field: (this.body as { collapse: { field: string } }).collapse.field,
        total_hits: aggregatedCount,
      };
    }
    if (opts.includeOptions) {
      result.options = this.options;
    }
    if (prev) {
      url.searchParams.set("page", String(prev));
      result.prev_url = url.toString();
    }
    if (next) {
      url.searchParams.set("page", String(next));
      result.next_url = url.toString();
    }
    if (searchToken) {
      result.search_token = searchToken;
    }

    return result;
  }

  async pageResponseInfo(
    responseBody: OpenSearchSearchResponse<unknown>,
    opts: { includeOptions?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const { hits } = responseBody;
    return this.pageInfo(hits.total.value, {
      aggregatedCount: hits.collapsed?.value,
      ...opts,
    });
  }
}
