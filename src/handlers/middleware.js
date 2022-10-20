const {
  addCorsHeaders,
  decodeEventBody,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
} = require("../helpers");

const processRequest = function (event) {
  let result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  return result;
};

const processResponse = function (event, response) {
  return addCorsHeaders(event, response);
};

module.exports = { processRequest, processResponse };
