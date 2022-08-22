const middleware = require("./middleware");
const { baseUrl } = require("../helpers");
const { modelsToTargets, validModels } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const { decodeSearchToken, Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");

const getSearch = async (event) => {
  event = middleware(event);
  let token = event.queryStringParameters.searchToken;
  if (token === undefined || token === "") {
    return invalidRequest("searchToken parameter is required");
  }

  let request;
  try {
    request = await decodeSearchToken(token);
  } catch (err) {
    return invalidRequest("searchToken is invalid");
  }

  const page = Number(event.queryStringParameters.page || 1);
  request.body.from = request.body.size * (page - 1);

  return await executeSearch(event, request.models, request.body);
};

const postSearch = async (event) => {
  event = middleware(event);
  const eventBody = JSON.parse(event.body);

  const requestedModels =
    event.pathParameters?.models == null
      ? ["works"]
      : event.pathParameters.models.split(",");

  return await executeSearch(event, requestedModels, eventBody);
};

/**
 * Function to wrap search requests and transform responses
 */
const executeSearch = async (event, models, body) => {
  if (!validModels(models)) {
    return invalidRequest(`Invalid models requested: ${models}`);
  }

  const pager = new Paginator(baseUrl(event), models, body);
  const filteredBody = new RequestPipeline(body).authFilter().toJson();
  let esResponse = await search(modelsToTargets(models), filteredBody);
  let transformedResponse = await opensearchResponse.transform(
    esResponse,
    pager
  );
  return transformedResponse;
};

const invalidRequest = (message) => {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: message }),
  };
};

module.exports = { postSearch, getSearch };
