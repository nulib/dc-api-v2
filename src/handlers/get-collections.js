const { doSearch } = require("./search-runner");
const { processRequest } = require("./middleware");

/**
 * A simple function to get Collections
 */
exports.handler = async (event) => {
  event = processRequest(event);
  event.pathParameters.models = "collections";
  event.body = { query: { match_all: {} } };
  return doSearch(event, { includeToken: false });
};
