const { doSearch } = require("./search-runner");

const getSearch = async (event) => {
  const includeToken = !!event.queryStringParameters?.searchToken;
  return await doSearch(event, { includeToken });
};

const postSearch = async (event) => await doSearch(event);

module.exports = { postSearch, getSearch };
