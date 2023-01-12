const { transformError } = require("./error.js");
const iiifCollectionResponse = require("./iiif/collection.js");
const opensearchResponse = require("./opensearch");

async function transformSearchResult(response, pager) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    const pageInfo = await pager.pageInfo(responseBody.hits.total.value);

    if (pageInfo.format === "iiif") {
      return await iiifCollectionResponse.transform(response, pager);
    }

    return await opensearchResponse.transform(response, pager);
  }
  return transformError(response);
}

module.exports = { transformSearchResult };
