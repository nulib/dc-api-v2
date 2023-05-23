const { wrap } = require("./middleware");
const { getSharedLink, getWork } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * Get a shared link document by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const sharedLinkResponse = await getSharedLink(id);
  const sharedLinkResponseBody = JSON.parse(sharedLinkResponse.body);
  const expirationDate = new Date(sharedLinkResponseBody?._source?.expires);
  const workId = sharedLinkResponseBody?._source?.target_id;

  if (linkExpired(expirationDate) || !workId)
    return invalidRequest("Not Found");

  const workResponse = await getWork(workId, {
    allowPrivate: true,
    allowUnpublished: true,
  });
  if (workResponse.statusCode !== 200) return invalidRequest("Not Found");

  event.userToken.addEntitlement(workId);
  return await opensearchResponse.transform(workResponse, {
    expires: expirationDate,
  });
});

const invalidRequest = (message) => {
  return {
    statusCode: 404,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ message: message }),
  };
};

const linkExpired = (expirationDate) => {
  return !isValid(expirationDate) || expirationDate <= new Date();
};

const isValid = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};
