const { doSearch } = require("./search-runner");
const { wrap } = require("./middleware");

/**
 * A simple function to get Collections
 */
exports.handler = wrap(async (event) => {
  event.pathParameters.models = "collections";
  event.body = { query: { match_all: {} } };
  return doSearch(event, { includeToken: false });
});
