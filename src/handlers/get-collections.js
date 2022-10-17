const { doSearch } = require("./search-runner");

/**
 * A simple function to get Collections
 */
exports.handler = async (event) => {
  event.pathParameters.models = "collections";
  event.body = { query: { match_all: {} } };
  return doSearch(event, { includeToken: false });
};
