const { getWork } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = async (event) => {
  const id = event.pathParameters.id;
  let esResponse = await getWork(id);
  return opensearchResponse.transform(esResponse);
};
