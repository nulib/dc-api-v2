const { processRequest, processResponse } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const { isFromReadingRoom } = require("../helpers");
const isObject = require("lodash.isobject");
const jwt = require("jsonwebtoken");

/**
 * Authorizes a FileSet by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;
  const osResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  if (osResponse.statusCode != 200) {
    return sendResponse(event, osResponse.statusCode, osResponse.statusCode);
  }

  const body = JSON.parse(osResponse.body);

  if (!body?.found) {
    return sendResponse(event, 404);
  }

  const fileSet = JSON.parse(osResponse.body)._source;
  const token = event.cookieObject.dcApiV2Token;
  const visibility = fileSet.visibility;
  const published = fileSet.published;
  const readingRoom = isFromReadingRoom(event);

  if (isAllowedVisibility(token, visibility, readingRoom) && published) {
    return sendResponse(event, 204);
  } else {
    return sendResponse(event, 403);
  }
};

function sendResponse(event, statusCode) {
  return processResponse(event, {
    statusCode: statusCode,
  });
}

function isAllowedVisibility(token, visibility, readingRoom) {
  switch (visibility) {
    case "Public":
      return true;
    case "Institution":
      return isValidToken(token);
    case "Private":
      return readingRoom;
    default:
      return false;
  }
}

function isValidToken(token) {
  if (!!token === false) return false;
  const user = jwt.verify(token, process.env.API_TOKEN_SECRET);
  return isObject(user);
}
