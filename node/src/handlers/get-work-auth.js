const { getWork } = require("../api/opensearch");
const { authorizeDocument } = require("./authorize-document");
const { wrap } = require("./middleware");

/**
 * Authorizes a Work by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;

  const osResponse = await getWork(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  return authorizeDocument(event, osResponse);
});
