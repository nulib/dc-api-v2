const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const allowPrivate = event.userToken.isReadingRoom();
  const esResponse = await getFileSet(id, { allowPrivate });
  return await opensearchResponse.transform(esResponse);
});
