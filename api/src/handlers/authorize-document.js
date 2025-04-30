/**
 * Authorizes a Document (Collection, FileSet or Work) by id
 */
const authorizeDocument = (event, osResponse) => {
  if (osResponse.statusCode != 200) {
    return sendResponse(osResponse.statusCode);
  }

  const body = JSON.parse(osResponse.body);
  const document = body._source;

  const token = event.userToken;

  const visibility = document.visibility;
  const published = document.published;
  const readingRoom = token.isReadingRoom();
  const workId = document.work_id || document.id;

  const allowed =
    token.isSuperUser() ||
    token.hasEntitlement(workId) ||
    (isAllowedVisibility(token, visibility, readingRoom) && published);

  return sendResponse(allowed ? 204 : 403);
};

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
      return token.isInstitution() || readingRoom;
    case "Private":
      return readingRoom;
    default:
      return false;
  }
}

module.exports = { authorizeDocument };
