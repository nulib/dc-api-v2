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

  if (token.isSuperUser()) {
    return sendResponse(204);
  } else if (token.hasEntitlement(workId)) {
    return sendResponse(204);
  } else if (isAllowedVisibility(token, visibility, readingRoom) && published) {
    return sendResponse(204);
  } else {
    return sendResponse(403);
  }
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
      return token.isLoggedIn() || readingRoom;
    case "Private":
      return readingRoom;
    default:
      return false;
  }
}

module.exports = { authorizeDocument };
