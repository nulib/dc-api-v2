const ApiToken = require("../api/api-token");
const { processRequest, processResponse } = require("./middleware");
const { getFileSet } = require("../api/opensearch");

const OPEN_DOCUMENT_NAMESPACE = /^0{8}-0{4}-0{4}-0{4}-0{9}[0-9A-Fa-f]{3}/;

/**
 * Authorizes a FileSet by id
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const id = event.pathParameters.id;

  // Special namespace for entities that aren't actual entities
  // with indexed metadata (i.e., placeholder images)
  if (OPEN_DOCUMENT_NAMESPACE.test(id)) return sendResponse(event, 204);

  const osResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  if (osResponse.statusCode != 200) {
    return sendResponse(event, osResponse.statusCode, osResponse.statusCode);
  }

  const body = JSON.parse(osResponse.body);
  const fileSet = body._source;

  const token = event.userToken;

  const visibility = fileSet.visibility;
  const published = fileSet.published;
  const readingRoom = token.isReadingRoom();
  const workId = fileSet.work_id;

  if (token.isSuperUser()) {
    return sendResponse(event, 204);
  } else if (token.hasEntitlement(workId)) {
    return sendResponse(event, 204);
  } else if (isAllowedVisibility(token, visibility, readingRoom) && published) {
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
      return token.isLoggedIn() || readingRoom;
    case "Private":
      return readingRoom;
    default:
      return false;
  }
}
