const { modelsToTargets, validModels } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const RequestPipeline = require("../api/request/pipeline.js");

/**
 * Function to wrap search requests and transform responses
 */
exports.handler = async (event) => {
  const eventBody = event.body;

  const requestedModels =
    event.pathParameters?.models == null
      ? ["works"]
      : event.pathParameters.models.split(",");

  if (!validModels(requestedModels)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid models requested: ${requestedModels}`,
      }),
    };
  }

  const filteredBody = new RequestPipeline(eventBody).authFilter().toJson();
  let esResponse = await search(modelsToTargets(requestedModels), filteredBody);
  let transformedResponse = opensearchResponse.transform(esResponse);
  return transformedResponse;
};

function validModels(models) {
  const validModels = models.filter((model) => isAllowed(model));
  return validModels.length > 0;
}

function isAllowed(model) {
  allowedModels = ["works", "file-sets", "collections"];
  return allowedModels.includes(model);
}

function modelsToTargets(models) {
  const mapTargets = {
    works: "dc-v2-work",
    "file-sets": "dc-v2-file-set",
    collections: "dc-v2-collection",
  };
  return String(models.map((model) => prefix(mapTargets[model])));
}
