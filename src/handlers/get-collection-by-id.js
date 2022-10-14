const { processRequest, processResponse } = require("./middleware");
const { getCollection } = require("../api/opensearch");
const { getSearch } = require("./search");
const opensearchResponse = require("../api/response/opensearch");

/**
 * Get a colletion by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const esResponse = await getCollection(id);

  const collection = JSON.parse(esResponse.body)?._source;

  if (event.queryStringParameters?.as === "iiif" && collection) {
    event.queryStringParameters.query = `collection.id:${id}`;
    event.queryStringParameters.collectionLabel = collection?.title || "";
    event.queryStringParameters.collectionSummary =
      collection?.description || "";
    return await getSearch(event);
  }

  const response = opensearchResponse.transform(esResponse);
  return processResponse(event, response);
};
