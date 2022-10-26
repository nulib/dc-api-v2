const { processRequest, processResponse } = require("./middleware");
const { getWork } = require("../api/opensearch");
const { isFromReadingRoom } = require("../helpers");

const manifestResponse = require("../api/response/iiif/manifest");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const allowPrivate = isFromReadingRoom(event);
  const esResponse = await getWork(id, { allowPrivate });

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
