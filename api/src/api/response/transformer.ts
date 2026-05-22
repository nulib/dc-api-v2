import { transformError } from "./error.ts";
import { transform as iiifCollectionResponse } from "./iiif/collection.ts";
import { transform as kmlResponse } from "./kml/index.ts";
import { transform as opensearchResponse } from "./opensearch/index.ts";
import type { Paginator } from "../pagination.ts";
import type { OpenSearchSearchResponse } from "../opensearch-types.ts";

// Hoist all inner_hits to the top, and if __pagination aggregation
// is present, use that for total hits instead of the hits.total.value
function applyInnerHits(response: { status: number; body: string }): {
  status: number;
  body: string;
} {
  const responseBody = JSON.parse(
    response.body,
  ) as OpenSearchSearchResponse<unknown>;
  if (responseBody.hits?.hits) {
    responseBody.hits.hits = responseBody.hits.hits
      .map((hit) => {
        if (hit.inner_hits) {
          const key = Object.keys(hit.inner_hits)[0];
          return hit.inner_hits[key].hits.hits;
        }
        return hit;
      })
      .flat();
  }
  if (responseBody?.aggregations?.__pagination) {
    responseBody.hits!.collapsed = {
      value: (responseBody.aggregations.__pagination as { value: number })
        .value,
    };
    delete responseBody.aggregations.__pagination;
    if (Object.keys(responseBody.aggregations).length === 0) {
      delete responseBody.aggregations;
    }
  }
  response.body = JSON.stringify(responseBody);
  return response;
}

export async function transformSearchResult(
  response: { status: number; body: string },
  pager: Paginator,
): Promise<Response> {
  if (response.status === 200) {
    response = applyInnerHits(response);
    const responseBody = JSON.parse(
      response.body,
    ) as OpenSearchSearchResponse<unknown>;
    const pageInfo = await pager.pageResponseInfo(responseBody);

    switch (pageInfo.format) {
      case "iiif":
        return await iiifCollectionResponse(response, pager);
      case "kml":
        return kmlResponse(responseBody);
      default:
        return await opensearchResponse(response, { pager: pager });
    }
  }
  return transformError(response);
}
