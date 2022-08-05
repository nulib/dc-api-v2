const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const RequestPipeline = require("../api/request/pipeline.js");

/**
 * Function to wrap search requests and transform responses
 */
exports.handler = async (event) => {
  const eventBody = event.body;
  console.log("RequestPipeline", RequestPipeline);
  const filteredBody = new RequestPipeline(eventBody).authFilter().toJson();
  let esResponse = await search(filteredBody);
  let transformedResponse = opensearchResponse.transform(esResponse);
  return transformedResponse;
};
