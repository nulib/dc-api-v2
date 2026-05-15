const { getFileSet } = require("../api/opensearch");
const iiifSearchResponse = require("../api/response/iiif/file-set-search");
const { wrap } = require("./middleware");

exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const { as, q } = event.queryStringParameters ?? {};

  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();

  if (as !== "iiif" || !q?.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Request must include ?as=iiif&q={query}",
      }),
    };
  }

  const fileSetResponse = await getFileSet(id, {
    allowPrivate,
    allowUnpublished,
  });
  if (fileSetResponse.statusCode !== 200) return fileSetResponse;

  const fileSetSource = JSON.parse(fileSetResponse.body)._source;
  return iiifSearchResponse.transform(fileSetSource, q);
});
