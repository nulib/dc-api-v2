const { processRequest, processResponse } = require("./middleware");
const { getWork } = require("../api/opensearch");

const manifestResponse = require("../api/response/iiif/manifest");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;

  const allowPrivate =
    event.userToken.isReadingRoom() || event.userToken.hasEntitlement(id);
  const allowUnpublished = event.userToken.hasEntitlement(id);

  const esResponse = await getWork(id, { allowPrivate, allowUnpublished });

  let response;
  const as = event.queryStringParameters.as;

  if (as && as === "iiif") {
    // Make it IIIFy
    response = manifestResponse.transform(esResponse);
  } else {
    response = await opensearchResponse.transform(esResponse);
  }

  return processResponse(event, response);
};
