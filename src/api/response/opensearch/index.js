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
    body: JSON.stringify({ data: responseBody._source, info: {} }),
  };
}

async function transformMany(responseBody, pager) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      data: extractSource(responseBody.hits.hits),
      pagination: await pager.pageInfo(responseBody.hits.total.value),
      info: {},
      aggregations: responseBody.aggregations,
    }),
  };
}

function transformError(response) {
  const responseBody = {
    status: response.statusCode,
    error: "TODO",
  };

  return {
    statusCode: response.statusCode,
    body: JSON.stringify(responseBody),
  };
}

function extractSource(hits) {
  return hits.map((hit) => extractSingle(hit));
}

function extractSingle(hit) {
  return hit._source;
}

module.exports = { transform };
