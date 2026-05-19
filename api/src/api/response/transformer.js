const { transformError } = require("./error.js");
const iiifCollectionResponse = require("./iiif/collection.js");
const opensearchResponse = require("./opensearch");

// Hoist all inner_hits to the top, and if __pagination aggregation
// is present, use that for total hits instead of the hits.total.value
function applyInnerHits(response) {
  const responseBody = JSON.parse(response.body);
  if (responseBody.hits?.hits) {
    responseBody.hits.hits = responseBody.hits.hits
      .map((hit) => {
        if (hit.inner_hits) {
          return hit.inner_hits[Object.keys(hit.inner_hits)[0]].hits.hits;
        }
        return hit;
      })
      .flat();
  }
  if (responseBody?.aggregations?.__pagination) {
    responseBody.hits.collapsed = {
      value: responseBody.aggregations.__pagination.value,
    };
    delete responseBody.aggregations.__pagination;
    if (Object.keys(responseBody.aggregations).length === 0) {
      delete responseBody.aggregations;
    }
  }
  response.body = JSON.stringify(responseBody);
  return response;
}

async function transformSearchResult(response, pager) {
  if (response.statusCode === 200) {
    response = applyInnerHits(response);
    const responseBody = JSON.parse(response.body);
    const pageInfo = await pager.pageResponseInfo(responseBody);

    if (pageInfo.format === "iiif") {
      return await iiifCollectionResponse.transform(response, pager);
    }

    return await opensearchResponse.transform(response, { pager: pager });
  }
  return transformError(response);
}

module.exports = { transformSearchResult };
