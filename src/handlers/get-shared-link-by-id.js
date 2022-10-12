const { processRequest, processResponse } = require("./middleware");
const { getSharedLink } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * Get a shared link document by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const esResponse = await getSharedLink(id);
  if (linkExpired(esResponse)) {
    return {
      statusCode: 404,
      headers: { "content-type": "text/plain" },
      body: "Not Found",
    };
  } else {
    const response = opensearchResponse.transform(esResponse);
    return processResponse(event, response);
  }
};

const linkExpired = (response) => {
  const body = JSON.parse(response.body);
  const expires = new Date(body?._source?.expires);

  return expires <= new Date();
};
