const middleware = require("./middleware");
const { baseUrl } = require("../helpers");
const { modelsToTargets } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const { Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");

const DefaultSize = 10;

const numberParam = (value, defaultValue) => {
  const result = Number(value);
  if (isNaN(result)) return defaultValue;
  return result;
};

/**
 * A simple function to get Collections
 */
exports.handler = async (event) => {
  event = middleware(event);

  const page = numberParam(event.queryStringParameters?.page, 1);
  if (page < 1) return invalidRequest("page must be >= 1");
  const size = numberParam(event.queryStringParameters?.size, DefaultSize);
  if (size < 1) return invalidRequest("size must be >= 1");

  let body = { size: size, from: size * (page - 1) };
  let models = ["collections"];

  const extraParams = size === DefaultSize ? {} : { size };
  const pager = new Paginator(
    baseUrl(event),
    "collections",
    models,
    body,
    null,
    { extraParams, includeToken: false }
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
