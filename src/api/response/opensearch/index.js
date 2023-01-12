const { transformError } = require("../error");

async function transform(response, pager) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    return await (responseBody?.hits?.hits
      ? transformMany(responseBody, pager)
      : transformOne(responseBody));
  }
  return transformError(response);
}

async function transformOne(responseBody) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ data: responseBody._source, info: {} }),
  };
}

async function transformMany(responseBody, pager) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      data: extractSource(responseBody.hits.hits),
      pagination: await paginationInfo(responseBody, pager),
      info: {},
      aggregations: responseBody.aggregations,
    }),
  };
}

async function paginationInfo(responseBody, pager) {
  let { format, options, ...pageInfo } = await pager.pageInfo(
    responseBody.hits.total.value
  );

  return pageInfo;
}

function extractSource(hits) {
  return hits.map((hit) => extractSingle(hit));
}

function extractSingle(hit) {
  return hit._source;
}

module.exports = { transform };
