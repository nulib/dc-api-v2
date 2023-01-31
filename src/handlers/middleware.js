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

const debug = require("debug")("api.middleware");
const Honeybadger = require("../honeybadger-setup");
const { StatusCodes } = require("http-status-codes");

const wrap = function (handler) {
  return async (event, context) => {
    let response;
    try {
      event = __processRequest(event);
      response = await handler(event, context);
    } catch (error) {
      if (Honeybadger.config.enableUncaught) {
        await Honeybadger.notifyAsync(error);
      }
      response = _convertErrorToResponse(error);
    }
    return __processResponse(event, response);
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

const __processRequest = function (event) {
  if (event.__processRequest) return event;
  let result = maybeUseProxiedIp(event);
  result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  result = decodeToken(result);
  result.__processRequest = true;

  Honeybadger.setContext({ event: result });
  debug(result);
  return result;
};

const __processResponse = function (event, response) {
  let result = addCorsHeaders(event, response);
  result = encodeToken(event, result);
  result = ensureCharacterEncoding(result, "UTF-8");
  debug(result);
  return result;
};

module.exports = {
  wrap,
  __processRequest,
  __processResponse,
  __Honeybadger: Honeybadger,
};
