import { appInfo } from "../../../environment.ts";
import { transformError } from "../error.ts";
import type { Paginator } from "../../pagination.ts";
import type {
  OpenSearchGetResponse,
  OpenSearchHit,
  OpenSearchSearchResponse,
} from "../../opensearch-types.ts";

export async function transform(
  response: { status: number; body: string },
  options: { pager?: Paginator; expires?: Date | number | null } = {},
): Promise<Response> {
  if (response.status === 200) {
    const responseBody = JSON.parse(response.body);
    return await (responseBody?.hits?.hits
      ? transformMany(
          responseBody as OpenSearchSearchResponse<unknown>,
          options,
        )
      : transformOne(responseBody as OpenSearchGetResponse<unknown>, options));
  }
  return transformError(response);
}

async function transformOne(
  responseBody: OpenSearchGetResponse<unknown>,
  options: { expires?: Date | number | null } = {},
): Promise<Response> {
  const body = JSON.stringify({
    data: responseBody._source,
    info: appInfo(options),
  });

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function transformMany(
  responseBody: OpenSearchSearchResponse<unknown>,
  options: { pager?: Paginator } = {},
): Promise<Response> {
  const body = JSON.stringify({
    data: extractSource(responseBody.hits.hits),
    pagination: await paginationInfo(responseBody, options?.pager),
    info: appInfo(),
    aggregations: responseBody.aggregations,
  });

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function paginationInfo(
  responseBody: OpenSearchSearchResponse<unknown>,
  pager?: Paginator,
): Promise<Record<string, unknown>> {
  const pageInfo = await pager!.pageResponseInfo(responseBody);
  return { ...pageInfo };
}

function extractSource(hits: OpenSearchHit<unknown>[]): unknown[] {
  return hits.map((hit) => hit._source);
}
