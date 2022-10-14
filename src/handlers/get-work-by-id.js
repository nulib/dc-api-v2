const { processRequest, processResponse } = require("./middleware");
const { getWork } = require("../api/opensearch");
const { isFromReadingRoom } = require("../helpers");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a Work by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const allowPrivate = isFromReadingRoom(event);
  const esResponse = await getWork(id, { allowPrivate });
  const response = opensearchResponse.transform(esResponse);
  return processResponse(event, response);
};
