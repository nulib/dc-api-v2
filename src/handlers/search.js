const { processRequest, processResponse } = require("./middleware");
const { baseUrl } = require("../helpers");
const {
  extractRequestedModels,
  modelsToTargets,
  validModels,
} = require("../api/request/models");
const { search } = require("../api/opensearch");
const responseTransformer = require("../api/response/transformer");
const { decodeSearchToken, Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");

const getSearch = async (event) => {
  event = processRequest(event);
  const models = extractRequestedModels(event.pathParameters?.models);
  const format = await responseFormat(event);

  let searchContext;

  try {
    searchContext = await constructSearchContext(event);
  } catch (error) {
    return invalidRequest(error.message);
  }

  const response = await executeSearch(
    event,
    models,
    searchContext,
    format,
    getOptions(event.queryStringParameters, format)
  );
  return processResponse(event, response);
};

const postSearch = async (event) => {
  event = processRequest(event);

  const searchContext = JSON.parse(event.body);
  const models = extractRequestedModels(event.pathParameters?.models);

  const response = await executeSearch(event, models, searchContext);
  return processResponse(event, response);
};

/**
 * Function to wrap search requests and transform responses
 */
const executeSearch = async (
  event,
  models,
  searchContext,
  format = "default",
  options = {}
) => {
  if (!validModels(models, format)) {
    return invalidRequest(`Invalid models requested: ${models}`);
  }

  const pager = new Paginator(
    baseUrl(event),
    "search",
    models,
    searchContext,
    format,
    options
  );
  const filteredSearchContext = new RequestPipeline(searchContext)
    .authFilter(event)
    .toJson();
  const esResponse = await search(
    modelsToTargets(models),
    filteredSearchContext
  );

  return await responseTransformer.transformSearchResult(esResponse, pager);
};

const invalidRequest = (message) => {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: message }),
  };
};

const constructSearchContext = async (event) => {
  const token = event.queryStringParameters?.searchToken;

  return token === undefined || token === ""
    ? fromQueryString(event.queryStringParameters)
    : await fromBody(event);
};

const fromQueryString = (queryStringParameters) => {
  let searchContext = {
    query: {
      query_string: {
        query: queryStringParameters?.query || "*",
      },
    },
  };

  if (queryStringParameters?.size) {
    searchContext.size = queryStringParameters.size;
  }

  if (queryStringParameters?.from) {
    searchContext.from = queryStringParameters.from;
  }

  if (queryStringParameters?.sort) {
    //TODO
  }
  return searchContext;
};

const responseFormat = async (event) => {
  if (event.queryStringParameters?.as) {
    return event.queryStringParameters?.as;
  } else {
    if (event.queryStringParameters?.searchToken === undefined)
      return "default";
    const token = event.queryStringParameters.searchToken;

    try {
      request = await decodeSearchToken(token);
    } catch (err) {
      return invalidRequest("searchToken is invalid");
    }
    return request.format;
  }
};

const fromBody = async (event) => {
  const token = event.queryStringParameters.searchToken;

  let request;

  try {
    request = await decodeSearchToken(token);
  } catch (err) {
    throw new Error("searchToken is invalid");
  }

  const page = Number(event.queryStringParameters.page || 1);
  request.body.from = request.body.size * (page - 1);

  return request.body;
};

const getOptions = (queryStringParameters, format) => {
  if (format === "iiif") {
    const collectionLabel =
      queryStringParameters?.collectionLabel || "IIIF Collection";
    const collectionSummary = queryStringParameters?.collectionSummary || "";
    const queryString = queryStringParameters.query || "*";
    return {
      collectionLabel: collectionLabel,
      collectionSummary: collectionSummary,
      queryString: queryString,
    };
  }
  return {};
};

module.exports = { postSearch, getSearch };
