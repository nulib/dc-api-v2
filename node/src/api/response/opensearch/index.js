const { appInfo } = require("../../../environment");
const { transformError } = require("../error");

async function transform(response, options = {}) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    return await (responseBody?.hits?.hits
      ? transformMany(responseBody, options)
      : transformOne(responseBody, options));
  }
  return transformError(response);
}

async function transformOne(responseBody, options = {}) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: responseBody._source,
      info: appInfo(options),
    }),
  };
}

async function transformMany(responseBody, options) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: extractSource(responseBody.hits.hits),
      pagination: await paginationInfo(responseBody, options?.pager),
      info: appInfo(),
      aggregations: responseBody.aggregations,
    }),
  };
}

async function paginationInfo(responseBody, pager) {
  let { ...pageInfo } = await pager.pageInfo(responseBody.hits.total.value);

  return pageInfo;
}

function extractSource(hits) {
  return hits.map((hit) => extractSingle(hit));
}

function extractSingle(hit) {
  return hit._source;
}

module.exports = { transform };
