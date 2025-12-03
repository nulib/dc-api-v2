const { wrap } = require("./middleware");
const { search, getFileSet } = require("../api/opensearch");
const { prefix, appInfo } = require("../environment");
const { transformError } = require("../api/response/error");

/**
 * Retrieves a single annotation by id
 */
exports.handler = wrap(async (event) => {
  const annotationId = event.pathParameters.id;

  const searchBody = {
    size: 1,
    _source: ["id"],
    query: {
      bool: {
        should: [
          { term: { "annotations.id.keyword": annotationId } },
          { term: { "annotations.id": annotationId } },
        ],
        minimum_should_match: 1,
      },
    },
  };

  const searchResponse = await search(
    prefix("dc-v2-file-set"),
    JSON.stringify(searchBody)
  );

  if (searchResponse.statusCode !== 200) {
    return transformError(searchResponse);
  }

  const searchPayload = JSON.parse(searchResponse.body);
  const hit = searchPayload?.hits?.hits?.[0];
  if (!hit) return transformError({ statusCode: 404 });

  const fileSetId = hit?._source?.id || hit?._id;
  if (!fileSetId) return transformError({ statusCode: 404 });

  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const fileSetResponse = await getFileSet(fileSetId, {
    allowPrivate,
    allowUnpublished,
  });

  if (fileSetResponse.statusCode !== 200) {
    return transformError(fileSetResponse);
  }

  const fileSetPayload = JSON.parse(fileSetResponse.body);
  const annotation = fileSetPayload?._source?.annotations?.find(
    (item) => item.id === annotationId
  );

  if (!annotation) return transformError({ statusCode: 404 });

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: annotation,
      info: appInfo(),
    }),
  };
});
