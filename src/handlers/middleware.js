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

const wrap = function (handler) {
  try {
    return async (event) => {
      event = _processRequest(event);
      const response = await handler(event);
      return _processResponse(event, response);
    };
  } catch (error) {
    console.error("error", error);
    return {
      statusCode: 400,
    };
  }
};

const _processRequest = function (event) {
  if (event.__processRequest) return event;
  let result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  result = decodeToken(result);
  result.__processRequest = true;
  return result;
};

const _processResponse = function (event, response) {
  let result = addCorsHeaders(event, response);
  result = encodeToken(event, result);
  result = ensureCharacterEncoding(result, "UTF-8");
  return result;
};

module.exports = { wrap, _processRequest, _processResponse };
