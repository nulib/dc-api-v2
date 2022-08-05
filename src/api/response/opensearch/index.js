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
    body: JSON.stringify({ data: responseBody._source }),
  };
}

function transformMany(responseBody) {
  return {
    statusCode: 200,
    body: JSON.stringify({ data: responseBody.hits, pagination: {} }),
  };
}

function transformError(response) {
  const responseBody = { status: response.statusCode, error: "TODO" };

  return {
    statusCode: response.statusCode,
    body: JSON.stringify(responseBody),
  };
}

module.exports = { transform };
