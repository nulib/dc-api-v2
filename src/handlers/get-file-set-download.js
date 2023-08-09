const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
// const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  console.log(esResponse);
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: "Hello World",
  };
  // return await opensearchResponse.transform(esResponse);
});
