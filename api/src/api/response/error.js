const { getReasonPhrase } = require("http-status-codes");

function transformError(response) {
  const responseBody = {
    status: response.statusCode,
    error: getReasonPhrase(response.statusCode),
  };

  return {
    statusCode: response.statusCode,
    body: JSON.stringify(responseBody),
  };
}

module.exports = { transformError };
