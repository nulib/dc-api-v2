const dcUrl = process.env.DC_URL || "http://placeholder-for-dc-url";

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
  const collectionLabel = pageInfo.options.collectionLabel;
  const collectionSummary = pageInfo.options.collectionSummary;

  return {
    "@context": ["http://iiif.io/api/presentation/3/context.json"],
    id: collectionId(pageInfo),
    type: "Collection",
    label: {
      none: [`${collectionLabel}`],
    },
    summary: {
      none: [`${collectionSummary}`],
    },
    homepage: [
      {
        id: homepageUrl(pageInfo),
        type: "Text",
        format: "text/html",
        label: {
          none: [`Results for ${collectionLabel} of ${collectionSummary}`],
        },
      },
    ],
    items: getItems(responseBody?.hits?.hits, pageInfo),
  };
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
  const result = new URL("/search", dcUrl);
  result.searchParams.set("q", pageInfo.options.queryString);
  return result;
}

function loadItem(item) {
  return {
    id: item.iiif_manifest,
    type: "Manifest",
    homepage: [
      {
        id: `${dcUrl}/items/${item.id}`,
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
        id: [`${item.representative_file_set.url}/full/400,/0/default.jpg`],
        service: [
          {
            profile: "http://iiif.io/api/image/2/level2.json",
            "@context": "http://iiif.io/api/image/2/context.json",
            "@id": `${item.representative_file_set.url}`,
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
