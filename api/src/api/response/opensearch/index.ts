import { appInfo } from "../../../environment.ts";
import { transformError } from "../error.ts";
import { generalizeStaff } from "../staff.ts";
import { ContentTypes } from "../content-types.ts";
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
    data: publicSource(source),
    info: appInfo(options),
  });
}

async function transformOne(
  responseBody: OpenSearchGetResponse<unknown>,
  options: { expires?: Date | number | null } = {},
): Promise<Response> {
  return new Response(documentBody(responseBody._source, options), {
    status: 200,
    headers: { "content-type": ContentTypes.JSON },
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
    headers: { "content-type": ContentTypes.JSON },
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
  return hits.map((hit) => publicSource(hit._source));
}

// A document (or list of annotations) as this API publishes it: staff
// credited collectively, and the full provenance exports left to the
// dedicated `?as=premis` and `?as=c2pa` endpoints.
function publicSource(source: unknown): unknown {
  if (Array.isArray(source)) return source.map(publicSource);
  return generalizeStaff(omitProvenanceExports(source));
}

// Omit `ai_provenance_exports` from regular documents, search hits, and their
// annotations. The `ai_provenance` summary stays: Digital Collections uses it.
// Never mutate the indexed source.
function omitProvenanceExports(source: unknown): unknown {
  if (!source || typeof source !== "object") return source;
  const { ai_provenance_exports: _exports, ...document } = source as Record<
    string,
    unknown
  >;
  if (Array.isArray(document.annotations)) {
    document.annotations = document.annotations.map(omitProvenanceExports);
  }
  return document;
}
