const {
  addCorsHeaders,
  decodeEventBody,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
} = require("../helpers");

const processRequest = function (event) {
  if (event._processRequest) return event;
  let result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  result._processRequest = true;
  return result;
};

const processResponse = function (event, response) {
  return addCorsHeaders(event, response);
};

module.exports = { processRequest, processResponse };
