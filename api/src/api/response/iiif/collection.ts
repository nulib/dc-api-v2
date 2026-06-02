import { dcApiEndpoint, dcUrl } from "../../../environment.ts";
import { transformError } from "../error.ts";
import { provider, nulLogo } from "./presentation-api/provider.ts";
import type { Paginator } from "../../pagination.ts";
import type { WorkSummarySource, NavPlace } from "./types.ts";

export async function transform(
  response: { status: number; body: string },
  pager: Paginator,
): Promise<Response> {
  if (response.status === 200) {
    const responseBody = JSON.parse(response.body);
    const pageInfo = await pager.pageResponseInfo(responseBody, {
      includeOptions: true,
    });

    return new Response(
      JSON.stringify(await buildCollection(responseBody, pageInfo)),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }
  return transformError(response);
}

async function buildCollection(
  responseBody: Record<string, unknown>,
  pageInfo: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const {
    options: {
      queryStringParameters: {
        collectionLabel = "IIIF Collection",
        collectionSummary = "",
      },
    },
    query_url,
  } = pageInfo as {
    options: { queryStringParameters: Record<string, string> };
    query_url: string;
  };

  const { pathname } = new URL(query_url);
  const isTopCollection = pathname.split("/").pop() === "collections";
  const collectionId = parseCollectionId(query_url);

  const result: Record<string, unknown> = {
    "@context": ["http://iiif.io/api/presentation/3/context.json"],
    id: iiifCollectionId(pageInfo),
    type: "Collection",
    label: { none: [collectionLabel] },
    ...(collectionSummary && { summary: { none: [`${collectionSummary}`] } }),
    items: getItems(
      (responseBody?.hits as { hits: Record<string, unknown>[] })?.hits,
      pageInfo,
      isTopCollection,
    ),
    requiredStatement: {
      label: { none: ["Attribution"] },
      value: { none: ["Courtesy of Northwestern University Libraries"] },
    },
    provider: [provider],
    logo: [nulLogo],
    seeAlso: [
      {
        id: isTopCollection
          ? `${dcApiEndpoint()}/collections`
          : getLinkingPropertyId(pageInfo, dcApiEndpoint(), "query"),
        type: "Dataset",
        format: "application/json",
        label: {
          none: ["Northwestern University Libraries Digital Collections API"],
        },
      },
    ],
    homepage: [
      {
        id: isTopCollection ? dcUrl() : getLinkingPropertyId(pageInfo, dcUrl()),
        type: "Text",
        format: "text/html",
        label: { none: [collectionLabel] },
      },
    ],
  };

  if (
    !isTopCollection &&
    (pageInfo.options as { parameterOverrides?: unknown })?.parameterOverrides
  ) {
    const thumbnailId = `${dcApiEndpoint()}/collections/${collectionId}/thumbnail`;
    result.thumbnail = [
      {
        id: thumbnailId,
        type: "Image",
        format: "image/jpeg",
        width: 400,
        height: 400,
      },
    ];
  }

  const navPlace = buildCollectionNavPlace(
    (responseBody?.hits as { hits: Record<string, unknown>[] })?.hits,
  );
  if (navPlace) result.navPlace = navPlace;

  return result;
}

function getItems(
  hits: Record<string, unknown>[],
  pageInfo: Record<string, unknown>,
  isTopCollection: boolean,
): Record<string, unknown>[] {
  const itemType = isTopCollection ? "Collection" : "Manifest";
  const size = (
    pageInfo.options as {
      queryStringParameters?: { size?: string };
    }
  )?.queryStringParameters?.size;
  const items = hits.map((item) =>
    loadItem(item["_source"] as WorkSummarySource, itemType, size),
  );

  if ((pageInfo as { next_url?: string })?.next_url) {
    items.push({
      id: (pageInfo as { next_url: string }).next_url,
      type: "Collection",
      label: { none: ["Next page"] },
    });
  }

  return items;
}

function iiifCollectionId(pageInfo: Record<string, unknown>): URL {
  const collectionId = new URL((pageInfo as { query_url: string }).query_url);
  if ((pageInfo as { current_page: number }).current_page > 1) {
    collectionId.searchParams.set(
      "page",
      String((pageInfo as { current_page: number }).current_page),
    );
  }
  const size = (
    pageInfo.options as {
      queryStringParameters?: { size?: string };
    }
  )?.queryStringParameters?.size;
  if (size) collectionId.searchParams.set("size", size);
  return collectionId;
}

function parseCollectionId(query_url: string): string {
  return new URL(query_url).pathname.split("/").reverse()[0];
}

function getLinkingPropertyId(
  pageInfo: Record<string, unknown>,
  baseUrl: string,
  queryParam = "q",
): URL {
  const options = pageInfo.options as {
    parameterOverrides?: unknown;
    queryStringParameters?: { query?: string };
  };
  const query_url = (pageInfo as { query_url: string }).query_url;

  if (options?.parameterOverrides) {
    const collectionId = parseCollectionId(query_url);
    return new URL(`/collections/${collectionId}`, baseUrl);
  } else {
    const result = new URL("/search", baseUrl);
    if (options?.queryStringParameters?.query) {
      result.searchParams.set(queryParam, options.queryStringParameters.query);
    }
    if (query_url.includes("similar")) {
      const found = query_url.match(/works\/(.*)\/similar/);
      if (found) result.searchParams.set("similar", found[1]);
    }
    return result;
  }
}

function loadItem(
  item: WorkSummarySource,
  itemType: string,
  size?: string,
): Record<string, unknown> {
  if (itemType === "Manifest") {
    return {
      id: item.iiif_manifest,
      type: "Manifest",
      homepage: [
        {
          id: new URL(`/items/${item.id}`, dcUrl()),
          type: "Text",
          format: "text/html",
          label: { none: [`${item.title}`] },
        },
      ],
      label: { none: [`${item.title ?? "No title"}`] },
      summary: { none: [`${item.work_type}`] },
      thumbnail: [
        {
          id: item.thumbnail,
          format: "image/jpeg",
          type: "Image",
          width: 400,
          height: 400,
        },
      ],
    };
  }

  return {
    id: size
      ? `${item.api_link}?as=iiif&size=${size}`
      : `${item.api_link}?as=iiif`,
    type: "Collection",
    label: { none: [`${item.title}`] },
    ...(item.description ? { summary: { none: [`${item.description}`] } } : {}),
    ...(item.thumbnail
      ? {
          thumbnail: [
            {
              id: item.thumbnail,
              type: "Image",
              format: "image/jpeg",
              width: 400,
              height: 400,
            },
          ],
        }
      : {}),
    ...(item.canonical_link
      ? {
          homepage: [
            {
              id: new URL(`/collections/${item.id}`, dcUrl()),
              type: "Text",
              format: "text/html",
              label: { none: [`${item.title}`] },
            },
          ],
        }
      : {}),
  };
}

function buildCollectionNavPlace(
  hits: Record<string, unknown>[] = [],
): Record<string, unknown> | null {
  if (!hits || hits.length === 0) return null;

  const allFeatures: Record<string, unknown>[] = [];

  hits.forEach((hit) => {
    const source = hit._source as WorkSummarySource | undefined;
    if (!source) return;

    const navPlace = source.navPlace ?? source.nav_place;
    if (!Array.isArray(navPlace)) return;

    const pointFeatures = navPlace
      .filter(
        (place): place is NavPlace =>
          !!place?.coordinates &&
          Array.isArray(place.coordinates) &&
          place.coordinates.length >= 2 &&
          !!place.label,
      )
      .map((place) => {
        const feature: Record<string, unknown> = {
          type: "Feature",
          geometry: { type: "Point", coordinates: place.coordinates },
          properties: { label: { en: [place.label] } },
        };
        if (place.id) feature.id = place.id;
        if (place.summary) {
          (feature.properties as Record<string, unknown>).summary = {
            en: [place.summary],
          };
        }
        return feature;
      });

    allFeatures.push(...pointFeatures);
  });

  if (!allFeatures.length) return null;

  return { type: "FeatureCollection", features: allFeatures };
}
