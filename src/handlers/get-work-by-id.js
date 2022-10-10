const { processRequest, processResponse } = require("./middleware");
const { getWork } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const esResponse = await getWork(id);
  const response = opensearchResponse.transform(esResponse);
  return processResponse(event, response);
};
