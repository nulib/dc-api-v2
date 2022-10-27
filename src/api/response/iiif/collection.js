const { dcApiEndpoint, dcUrl } = require("../../../aws/environment");

async function transform(response, pager) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    const pageInfo = await pager.pageInfo(responseBody.hits.total.value);

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
  } = pageInfo;

  result = {
    "@context": ["http://iiif.io/api/presentation/3/context.json"],
    id: collectionId(pageInfo),
    type: "Collection",
    label: { none: [collectionLabel] },
    summary: { none: [collectionSummary] },
    homepage: [
      {
        id: homepageUrl(pageInfo),
        type: "Text",
        format: "text/html",
        label: {
          none: [collectionLabel],
        },
      },
    ],

    items: getItems(responseBody?.hits?.hits, pageInfo),
  };

  if (pageInfo.options?.parameterOverrides) {
    const collectionId = new URL(pageInfo.query_url).pathname
      .split("/")
      .reverse()[0];
    thumbnailId = new URL(
      `${dcApiEndpoint()}/collections/${collectionId}/thumbnail`
    );
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

function getItems(hits, pageInfo) {
  const items = hits.map((item) => loadItem(item["_source"]));

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

function collectionId(pageInfo) {
  let collectionId = new URL(pageInfo.query_url);
  if (pageInfo.current_page > 1) {
    collectionId.searchParams.set("page", pageInfo.current_page);
  }
  return collectionId;
}

function homepageUrl(pageInfo) {
  let result;

  if (pageInfo.options?.parameterOverrides) {
    const collectionId = new URL(pageInfo.query_url).pathname
      .split("/")
      .reverse()[0];
    result = new URL(`/collections/${collectionId}`, dcUrl());
  } else {
    result = new URL("/search", dcUrl());
    if (pageInfo.options?.queryStringParameters?.query)
      result.searchParams.set(
        "q",
        pageInfo.options.queryStringParameters.query
      );
  }

  return result;
}

function loadItem(item) {
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
        id: `${item.representative_file_set.url}/full/400,/0/default.jpg`,
        service: [
          {
            profile: "http://iiif.io/api/image/2/level2.json",
            "@context": "http://iiif.io/api/image/2/context.json",
            "@id": item.representative_file_set.url,
          },
        ],
        type: "Image",
        width: 400,
        height: 400,
      },
    ],
  };
}

function transformError(response) {
  const responseBody = { status: response.statusCode, error: "TODO" };

  return {
    statusCode: response.statusCode,
    body: JSON.stringify(responseBody),
  };
}

module.exports = { transform };
