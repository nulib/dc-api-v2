const { dcApiEndpoint, dcUrl } = require("../../../environment");
const { transformError } = require("../error");
const { provider, nulLogo } = require("./presentation-api/provider");

async function transform(response, pager) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    const pageInfo = await pager.pageInfo(responseBody.hits.total.value, {
      includeOptions: true,
    });

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(await buildCollection(responseBody, pageInfo)),
    };
  }
  return transformError(response);
}

async function buildCollection(responseBody, pageInfo) {
  const {
    options: {
      queryStringParameters: {
        collectionLabel = "IIIF Collection",
        collectionSummary = "",
      },
    },
    query_url,
  } = pageInfo;

  /**
   * if the query_url pathname is `/collections` then  we
   * know this is a top-level "collection of collections"
   */
  const { pathname } = new URL(query_url);
  const isTopCollection = pathname.split("/").pop() === "collections";
  const collectionId = parseCollectionId(pageInfo.query_url);

  let result = {
    "@context": ["http://iiif.io/api/presentation/3/context.json"],
    id: iiifCollectionId(pageInfo),
    type: "Collection",
    label: { none: [collectionLabel] },
    ...(collectionSummary && {
      summary: {
        none: [`${collectionSummary}`],
      },
    }),
    items: getItems(responseBody?.hits?.hits, pageInfo, isTopCollection),
    requiredStatement: {
      label: {
        none: ["Attribution"],
      },
      value: {
        none: ["Courtesy of Northwestern University Libraries"],
      },
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
        label: {
          none: [collectionLabel],
        },
      },
    ],
  };

  if (!isTopCollection && pageInfo.options?.parameterOverrides) {
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

  return result;
}

function getItems(hits, pageInfo, isTopCollection) {
  const itemType = isTopCollection ? "Collection" : "Manifest";
  const items = hits.map((item) => loadItem(item["_source"], itemType));

  if (pageInfo?.next_url) {
    items.push({
      id: pageInfo.next_url,
      type: "Collection",
      label: {
        none: ["Next page"],
      },
    });
  }

  return items;
}

function iiifCollectionId(pageInfo) {
  let collectionId = new URL(pageInfo.query_url);
  if (pageInfo.current_page > 1) {
    collectionId.searchParams.set("page", pageInfo.current_page);
  }
  return collectionId;
}

function parseCollectionId(query_url) {
  return new URL(query_url).pathname.split("/").reverse()[0];
}

function getLinkingPropertyId(pageInfo, baseUrl, queryParam = "q") {
  let result;

  if (pageInfo.options?.parameterOverrides) {
    const collectionId = parseCollectionId(pageInfo.query_url);
    result = new URL(`/collections/${collectionId}`, baseUrl);
  } else {
    result = new URL("/search", baseUrl);
    if (pageInfo.options?.queryStringParameters?.query) {
      result.searchParams.set(
        queryParam,
        pageInfo.options.queryStringParameters.query
      );
    }

    if (pageInfo.query_url.includes("similar")) {
      // Grab the work id from the query_url and add it to the search params
      const regex = /works\/(.*)\/similar/;
      const found = pageInfo.query_url.match(regex);
      result.searchParams.set("similar", found[1]);
    }
  }

  return result;
}

function loadItem(item, itemType) {
  if (itemType === "Manifest") {
    return {
      id: item.iiif_manifest,
      type: "Manifest",
      homepage: [
        {
          id: new URL(`/items/${item.id}`, dcUrl()),
          type: "Text",
          format: "text/html",
          label: {
            none: [`${item.title}`],
          },
        },
      ],
      label: {
        none: [`${item.title}`],
      },
      summary: {
        none: [`${item.work_type}`],
      },
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

  if (itemType === "Collection") {
    return {
      id: `${item.api_link}?as=iiif`,
      type: "Collection",
      label: {
        none: [`${item.title}`],
      },
      ...(item.description && {
        summary: {
          none: [`${item.description}`],
        },
      }),
      ...(item.thumbnail && {
        thumbnail: [
          {
            id: item.thumbnail,
            type: "Image",
            format: "image/jpeg",
            width: 400,
            height: 400,
          },
        ],
      }),
      ...(item.canonical_link && {
        homepage: [
          {
            id: new URL(`/collections/${item.id}`, dcUrl()),
            type: "Text",
            format: "text/html",
            label: {
              none: [`${item.title}`],
            },
          },
        ],
      }),
    };
  }
}

module.exports = { transform };
