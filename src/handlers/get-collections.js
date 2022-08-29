const middleware = require("./middleware");
const { baseUrl } = require("../helpers");
const { modelsToTargets } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const { decodeSearchToken, Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");

/**
 * A simple function to get Collections
 */
exports.handler = async (event) => {
  event = middleware(event);

  let token = event?.queryStringParameters?.searchToken;

  let models = ["collections"];
  let body = "";

  if (token) {
    try {
      const request = await decodeSearchToken(token);
      const page = Number(event.queryStringParameters.page || 1);
      request.body.from = request.body.size * (page - 1);
      models = request.models;
      body = request.body;
    } catch (err) {
      return invalidRequest("searchToken is invalid");
    }
  }

  const pager = new Paginator(baseUrl(event), "collections", models, body);
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
