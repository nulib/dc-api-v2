const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const { appInfo } = require("../environment");
const opensearchResponse = require("../api/response/opensearch");

/**
 * Returns annotations for a FileSet
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();

  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  if (esResponse.statusCode !== 200) {
    return await opensearchResponse.transform(esResponse);
  }

  const body = JSON.parse(esResponse.body);
  const annotations = body?._source?.annotations ?? null;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: annotations,
      info: appInfo(),
    }),
  };
});
