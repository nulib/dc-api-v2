const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");
const canvasResponse = require("../api/response/iiif/canvas");
const { transform } = require("lodash");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  const as = event.queryStringParameters?.as;


  if (as && as === "iiif") {
    return await canvasResponse.transform(esResponse, {
      allowPrivate,
      allowUnpublished,
    });
  }




  return await opensearchResponse.transform(esResponse);
});