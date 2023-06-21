const { getFileSet } = require("../api/opensearch");
const { authorizeDocument } = require("./authorize-document");
const { wrap } = require("./middleware");

const OPEN_DOCUMENT_NAMESPACE = /^0{8}-0{4}-0{4}-0{4}-0{9}[0-9A-Fa-f]{3}/;

/**
 * Authorizes a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;

  // Special namespace for entities that aren't actual entities
  // with indexed metadata (i.e., placeholder images)
  if (OPEN_DOCUMENT_NAMESPACE.test(id))
    return {
      statusCode: 204,
    };

  const osResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  return authorizeDocument(event, osResponse);
});
