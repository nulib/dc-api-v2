import { appInfo } from "../../../environment.ts";
import { transformError } from "../error.ts";
import { generalizeStaff } from "../staff.ts";
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

/**
 * The serialized body of a single-document response. Exported because these
 * exact bytes are what a C2PA manifest for the document is bound to
 * (`provenance/c2pa.ts`), and the manifest is only valid while
 * `GET /works/{id}` serves them unchanged. Keep this a pure function of the
 * document and `options`, and keep `options` empty on that route.
 */
export function documentBody(
  source: unknown,
  options: { expires?: Date | number | null } = {},
): string {
  return JSON.stringify({
    data: generalizeStaff(source),
    info: appInfo(options),
  });
}

async function transformOne(
  responseBody: OpenSearchGetResponse<unknown>,
  options: { expires?: Date | number | null } = {},
): Promise<Response> {
  return new Response(documentBody(responseBody._source, options), {
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
  return hits.map((hit) => generalizeStaff(hit._source));
}
