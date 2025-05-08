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

  const { published, visibility } = document;
  const workId = document.work_id || document.id;
  let allowed = token.hasEntitlement(workId);

  if (!allowed) {
    const publishedState = published ? "Published" : "Unpublished";
    allowed = [`read:${visibility}`, `read:${publishedState}`].every(
      (ability) => token.can(ability)
    );
  }

  return sendResponse(allowed ? 204 : 403);
};

function sendResponse(statusCode) {
  return {
    statusCode: statusCode,
  };
}

module.exports = { authorizeDocument };
