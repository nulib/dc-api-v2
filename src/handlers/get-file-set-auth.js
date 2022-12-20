const { getFileSet } = require("../api/opensearch");
const { wrap } = require("./middleware");

const OPEN_DOCUMENT_NAMESPACE = /^0{8}-0{4}-0{4}-0{4}-0{9}[0-9A-Fa-f]{3}/;

/**
 * Authorizes a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;

  // Special namespace for entities that aren't actual entities
  // with indexed metadata (i.e., placeholder images)
  if (OPEN_DOCUMENT_NAMESPACE.test(id)) return sendResponse(204);

  const osResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  if (osResponse.statusCode != 200) {
    return sendResponse(osResponse.statusCode);
  }

  const body = JSON.parse(osResponse.body);
  const fileSet = body._source;

  const token = event.userToken;

  const visibility = fileSet.visibility;
  const published = fileSet.published;
  const readingRoom = token.isReadingRoom();
  const workId = fileSet.work_id;

  if (token.isSuperUser()) {
    return sendResponse(204);
  } else if (token.hasEntitlement(workId)) {
    return sendResponse(204);
  } else if (isAllowedVisibility(token, visibility, readingRoom) && published) {
    return sendResponse(204);
  } else {
    return sendResponse(403);
  }
});

function sendResponse(statusCode) {
  return {
    statusCode: statusCode,
  };
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
