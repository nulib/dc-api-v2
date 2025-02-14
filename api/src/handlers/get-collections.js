const { doSearch } = require("./search-runner");
const { wrap } = require("./middleware");

const getCollections = async (event) => {
  event.pathParameters.models = "collections";
  event.body = { query: { match_all: {} } };
  return doSearch(event, { includeToken: false });
};

const getCollectionsAsIiif = async (event) => {
  event.pathParameters.models = "collections";
  event.body = { query: { match_all: {} } };
  event.queryStringParameters.collectionLabel =
    "Northwestern University Libraries Digital Collections";
  event.queryStringParameters.collectionSummary =
    "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials.";

  return doSearch(event, {
    includeToken: false,
    parameterOverrides: { as: "iiif" },
  });
};

/**
 * A simple function to get Collections
 */
exports.handler = wrap(async (event) => {
  return event.queryStringParameters?.as === "iiif"
    ? getCollectionsAsIiif(event)
    : getCollections(event);
});
