const { doSearch } = require("./search-runner");
const { wrap } = require("./middleware");

const getSearch = wrap(async (event) => {
  const includeToken = !!event.queryStringParameters?.searchToken;
  return await doSearch(event, { includeToken });
});

const postSearch = wrap(async (event) => await doSearch(event));

module.exports = { postSearch, getSearch };
