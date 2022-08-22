const middleware = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = async (event) => {
  event = middleware(event);
  const id = event.pathParameters.id;
  let esResponse = await getFileSet(id);
  return opensearchResponse.transform(esResponse);
};
