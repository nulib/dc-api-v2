const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = async (event) => {
  const id = event.pathParameters.id;
  let esResponse = await getFileSet(id);
  return opensearchResponse.transform(esResponse);
};
