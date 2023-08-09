const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email
  if(!email){
    return invalidRequest(400, "Query string must include email address")
  }
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  console.log(esResponse);

  if (esResponse.statusCode == "200") {
    const doc = JSON.parse(esResponse.body)
    if (downloadAvailable(doc)) {
      return processDownload(doc._source.streaming_url, email);
    } else {
      return invalidRequest(405, "Download only allowed for role: Access, work_type: Video or Audio, with a valid streaming_url")
    }
  } else {
    return await opensearchResponse.transform(esResponse);
  }
});

function downloadAvailable(doc) {
  console.log("doc.found", doc.found)
  console.log("doc._source.role", doc._source.role)
  console.log("doc._source.streaming_url", doc._source.streaming_url)
  return (
    doc.found &&
    doc._source.role === "Access" &&
    doc._source.streaming_url != null
  );
}

function processDownload(streaming_url) {
  return {
    statusCode: 200,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({
      message: `Creating download for ${streaming_url}. Check your email for a link.`,
    }),
  };
}

function invalidRequest(code, message) {
  return {
    statusCode: code,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ message: message }),
  };
};
