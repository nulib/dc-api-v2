const { getWork } = require("../api/search-index");

/**
 * A simple function to get a work by id
 */
exports.handler = async (event) => {
  const id = event.pathParameters.id;
  let esResponse = await getWork(id);
  return esResponse;
};
