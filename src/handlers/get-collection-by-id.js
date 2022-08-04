const { getCollection } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Collection by id
 */
exports.handler = async (event) => {
  const id = event.pathParameters.id;
  let esResponse = await getCollection(id);
  return opensearchResponse.transform(esResponse);
};
