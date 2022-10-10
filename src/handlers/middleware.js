const {
  addCorsHeaders,
  decodeEventBody,
  normalizeHeaders,
  objectifyCookies,
} = require("../helpers");

const processRequest = function (event) {
  let result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  return result;
};

const processResponse = function (event, response) {
  return addCorsHeaders(event, response);
};

module.exports = { processRequest, processResponse };
