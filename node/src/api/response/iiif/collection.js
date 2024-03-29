const { dcApiEndpoint, dcUrl } = require("../../../environment");
const { transformError } = require("../error");

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
  } = pageInfo;

  let result = {
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
    if (pageInfo.options?.queryStringParameters?.query) {
      result.searchParams.set(
        "q",
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
        id: item.thumbnail,
        format: "image/jpeg",
        type: "Image",
        width: 400,
        height: 400,
      },
    ],
  };
}

module.exports = { transform };
