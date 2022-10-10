const { processRequest, processResponse } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const esResponse = await getFileSet(id);
  const response = opensearchResponse.transform(esResponse);
  return processResponse(event, response);
};
