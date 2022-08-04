function transform(response) {

  if (response.statusCode === 200){
    return response?.hits?.hits ? 
      transformMany(response) : 
      transformOne(response);
  }
  return transformError(response);
}

function transformOne(response) {
  const responseBody = {data: JSON.parse(response.body)._source}

  return {statusCode: 200, body: JSON.stringify(responseBody)};
}

function transformMany(response) {
  return response;
}

function transformError(response){
  const responseBody = {status: response.statusCode, error: "TODO"}

  return {statusCode: response.statusCode, body: JSON.stringify(responseBody)};
}

module.exports = { transform }