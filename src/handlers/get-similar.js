const { baseUrl } = require("../helpers");
const { modelsToTargets } = require("../api/request/models");
const { search } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const { Paginator } = require("../api/pagination");
const { processRequest, processResponse } = require("./middleware");
const RequestPipeline = require("../api/request/pipeline");

const DefaultSize = 5;

const numberParam = (value, defaultValue) => {
  const result = Number(value);
  if (isNaN(result)) return defaultValue;
  return result;
};

/**
 * Get similar works via 'More Like This' query
 */
exports.handler = async (event) => {
  event = processRequest(event);

  const id = event.pathParameters.id;
  const page = numberParam(event.queryStringParameters?.page, 1);
  if (page < 1) return invalidRequest("page must be >= 1");
  const size = numberParam(event.queryStringParameters?.size, DefaultSize);
  if (size < 1) return invalidRequest("size must be >= 1");

  const models = ["works"];
  const workIndex = modelsToTargets(models);

  let body = {
    size: size,
    from: size * (page - 1),
    query: {
      more_like_this: {
        fields: [
          "title",
          "description",
          "subject.label",
          "genre.label",
          "contributor.label",
          "creator.label",
        ],
        like: [
          {
            _index: workIndex,
            _id: id,
          },
        ],
        max_query_terms: 10,
        min_doc_freq: 1,
        min_term_freq: 1,
      },
    },
  };

  const extraParams = size === DefaultSize ? {} : { size };
  const pager = new Paginator(
    baseUrl(event),
    `works/${id}/similar`,
    models,
    body,
    null,
    {
      extraParams,
      includeToken: false,
    }
  );
  const filteredBody = new RequestPipeline(body).authFilter().toJson();
  let esResponse = await search(workIndex, filteredBody);
  let transformedResponse = await opensearchResponse.transform(
    esResponse,
    pager
  );
  return processResponse(event, transformedResponse);
};

const invalidRequest = (message) => {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: message }),
  };
};
