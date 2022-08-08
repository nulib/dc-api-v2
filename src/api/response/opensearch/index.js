function transform(response) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    return responseBody?.hits?.hits
      ? transformMany(responseBody)
      : transformOne(responseBody);
  }
  return transformError(response);
}

function transformOne(responseBody) {
  return {
    statusCode: 200,
    body: JSON.stringify({ data: responseBody._source, info: {} }),
  };
}

function transformMany(responseBody) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      data: extractSource(responseBody.hits.hits),
      pagination: { total: responseBody.hits.total.value },
      info: {},
      aggregations: responseBody.aggregations,
    }),
  };
}

function transformError(response) {
  const responseBody = { status: response.statusCode, error: "TODO" };

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
