const {
  addCorsHeaders,
  decodeEventBody,
  decodeToken,
  encodeToken,
  ensureCharacterEncoding,
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
  result = decodeToken(result);
  result._processRequest = true;
  return result;
};

const processResponse = function (event, response) {
  let result = addCorsHeaders(event, response);
  result = encodeToken(event, result);
  result = ensureCharacterEncoding(result, "UTF-8");
  return result;
};

module.exports = { processRequest, processResponse };
