const { getWork } = require("../api/opensearch");
const manifestResponse = require("../api/response/iiif/manifest");
const { wrap } = require("./middleware");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;

  const allowPrivate =
    event.userToken.isSuperUser() ||
    event.userToken.isReadingRoom() ||
    event.userToken.hasEntitlement(id);
  const allowUnpublished =
    event.userToken.isSuperUser() || event.userToken.hasEntitlement(id);

  const esResponse = await getWork(id, { allowPrivate, allowUnpublished });

  const as = event.queryStringParameters.as;

  if (as && as === "iiif") {
    // Make it IIIFy
    return await manifestResponse.transform(esResponse, {
      allowPrivate,
      allowUnpublished,
    });
  }

  return await opensearchResponse.transform(esResponse);
});
