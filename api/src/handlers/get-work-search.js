const { getWork } = require("../api/opensearch");
const iiifSearchResponse = require("../api/response/iiif/search");
const { wrap } = require("./middleware");

exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const { as, q } = event.queryStringParameters;

  const allowPrivate =
    event.userToken.isSuperUser() ||
    event.userToken.isReadingRoom() ||
    event.userToken.hasEntitlement(id);
  const allowUnpublished =
    event.userToken.isSuperUser() || event.userToken.hasEntitlement(id);

  if (as !== "iiif" || !q?.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Request must include ?as=iiif&q={query}",
      }),
    };
  }

  const workResponse = await getWork(id, { allowPrivate, allowUnpublished });
  if (workResponse.statusCode !== 200) return workResponse;

  return iiifSearchResponse.transform(id, q, {
    allowPrivate,
    allowUnpublished,
  });
});
