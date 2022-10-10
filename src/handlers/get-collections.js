const middleware = require("./middleware");
const { baseUrl } = require("../helpers");
const { modelsToTargets } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const { Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");

const numberParam = (value, defaultValue) => {
  if (value === undefined) return defaultValue;
  return Number(value);
};

/**
 * A simple function to get Collections
 */
exports.handler = async (event) => {
  event = middleware(event);

  const page = numberParam(event.queryStringParameters?.page, 1);
  if (isNaN(page) || page < 1) return invalidRequest("page must be >= 1");
  const size = numberParam(event.queryStringParameters?.size, 10);
  if (isNaN(size) || size < 1) return invalidRequest("size must be >= 1");

  let body = { size: size, from: size * (page - 1) };
  let models = ["collections"];

  const pager = new Paginator(
    baseUrl(event),
    "collections",
    models,
    body,
    null,
    { includeToken: false }
  );
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
