const { baseUrl } = require("../helpers");
const { processRequest, processResponse } = require("./middleware");
const {
  extractRequestedModels,
  modelsToTargets,
  validModels,
} = require("../api/request/models");
const { search } = require("../api/opensearch");
const responseTransformer = require("../api/response/transformer");
const { decodeSearchToken, Paginator } = require("../api/pagination");
const RequestPipeline = require("../api/request/pipeline");
const Path = require("path");

/**
 * Function to wrap search requests and transform responses
 */
const doSearch = async (event, searchParams = {}) => {
  event = processRequest(event);
  const models = extractRequestedModels(event.pathParameters?.models);
  const format = await responseFormat(event);

  let searchContext;
  try {
    searchContext = await constructSearchContext(event);
  } catch (error) {
    return invalidRequest(error.message);
  }

  if (!validModels(models, format)) {
    return invalidRequest(`Invalid models requested: ${models}`);
  }

  const base = new URL(baseUrl(event));
  const path = Path.relative(base.pathname, event.requestContext?.http?.path);

  const pager = new Paginator(
    base.toString(),
    path,
    models,
    searchContext,
    format,
    {
      ...searchParams,
      queryStringParameters: event.queryStringParameters,
    }
  );
  const filteredSearchContext = new RequestPipeline(searchContext)
    .authFilter(event)
    .toJson();

  const esResponse = await search(
    modelsToTargets(models),
    filteredSearchContext
  );

  const response = await responseTransformer.transformSearchResult(
    esResponse,
    pager
  );
  return processResponse(event, response);
};

const invalidRequest = (message) => {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: message }),
  };
};

const constructSearchContext = async (event) => {
  let searchContext;

  if (typeof event.body === "object") {
    searchContext = event.body;
  } else if (event.requestContext.http.method === "POST") {
    searchContext = JSON.parse(event.body);
  } else {
    const token = event.queryStringParameters?.searchToken;
    searchContext =
      token === undefined || token === ""
        ? fromQueryString(event)
        : await fromToken(event);
  }

  const { queryStringParameters = {} } = event;

  searchContext.size = queryStringParameters.size || searchContext.size || 10;
  searchContext.from = queryStringParameters.from || searchContext.from || 0;

  if (queryStringParameters.page) {
    const page = Number(queryStringParameters.page || 1);
    const size = Number(queryStringParameters.size || 10);
    searchContext.from = (page - 1) * size;
  }

  // if (queryStringParameters.sort) {
  //   //TODO
  // }

  return searchContext;
};

const fromQueryString = ({ queryStringParameters, requestContext }) => {
  if (queryStringParameters?.query) {
    return {
      query: {
        query_string: {
          query: queryStringParameters.query,
        },
      },
    };
  } else {
    return {
      query: {
        query_string: {
          query: "*",
        },
      },
    };
  }
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

const fromToken = async (event) => {
  const token = event.queryStringParameters.searchToken;

  let request;

  try {
    request = await decodeSearchToken(token);
  } catch (err) {
    throw new Error("searchToken is invalid");
  }

  return request.body;
};

module.exports = { doSearch };
