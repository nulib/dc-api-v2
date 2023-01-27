const {
  addCorsHeaders,
  decodeEventBody,
  decodeToken,
  encodeToken,
  ensureCharacterEncoding,
  maybeUseProxiedIp,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
} = require("../helpers");

const Honeybadger = require("../honeybadger-setup");
const { StatusCodes } = require("http-status-codes");

const wrap = function (handler) {
  return async (event, context) => {
    let response;
    try {
      event = _processRequest(event);
      response = await handler(event, context);
    } catch (error) {
      await Honeybadger.notifyAsync(error);
      response = _convertErrorToResponse(error);
    }
    return _processResponse(event, response);
  };
};

const _convertErrorToResponse = function (error) {
  if (error.response && error.response.status) {
    return {
      statusCode: error.response.status,
      headers: error.response.headers,
      body: error.response.body,
    };
  } else {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      headers: { "content-type": "text/plain" },
      body: error.message,
    };
  }
};

const _processRequest = function (event) {
  if (event.__processRequest) return event;
  let result = maybeUseProxiedIp(event);
  result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  result = decodeToken(result);
  result.__processRequest = true;

  Honeybadger.setContext({ event: result });
  if (!!process.env.DEBUG) console.log(result);
  return result;
};

const _processResponse = function (event, response) {
  let result = addCorsHeaders(event, response);
  result = encodeToken(event, result);
  result = ensureCharacterEncoding(result, "UTF-8");
  if (!!process.env.DEBUG) console.log(result);
  return result;
};

module.exports = {
  wrap,
  _processRequest,
  _processResponse,
  __Honeybadger: Honeybadger,
};
