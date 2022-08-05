const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * Function to wrap search requests and transform responses
 */
exports.handler = async (event) => {
  const eventBody = event.body;
  let esResponse = await search(eventBody);
  let transformedResponse = opensearchResponse.transform(esResponse);
  return transformedResponse;
};
