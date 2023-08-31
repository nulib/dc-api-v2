const parseHeader = require("parse-http-header");
const path = require("path");
const gatewayRe = /execute-api.[a-z]+-[a-z]+-\d+.amazonaws.com/;
const { apiTokenName } = require("./environment");
const ApiToken = require("./api/api-token");
const cookie = require("cookie");
const crypto = require("crypto");
const _ = require("lodash");

const AcceptableHeaders = [
  "Accept",
  "Accept-Charset",
  "Accept-Encoding",
  "Accept-Language",
  "Accept-Datetime",
  "Authorization",
  "Cache-Control",
  "Content-Length",
  "Content-Type",
  "Cookie",
  "Date",
  "Expect",
  "Host",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
  "Origin",
  "Pragma",
  "Range",
  "Referer",
  "User-Agent",
  "X-CSRF-Token",
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Forwarded-Port",
  "X-Requested-With",
];

const ExposedHeaders = [
  "Cache-Control",
  "Content-Language",
  "Content-Length",
  "Content-Type",
  "Date",
  "ETag",
  "Expires",
  "Last-Modified",
  "Pragma",
];

const TextTypes = new RegExp(/^(application\/(json|(.+\+)?xml)$|text\/)/);

function addCorsHeaders(event, response) {
  const allowOrigin = event?.headers?.origin || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": AcceptableHeaders.join(", "),
    "Access-Control-Allow-Methods": "POST, GET, HEAD, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": ExposedHeaders.join(", "),
    "Access-Control-Max-Age": "600",
  };
  if (!response.headers) response.headers = {};
  Object.assign(response.headers, corsHeaders);
  return response;
}

function addEtag(event, response) {
  if (!response.body) return response;

  if (!response.headers) response.headers = {};
  response.headers.ETag = crypto
    .createHash("md5")
    .update(response.body)
    .digest("hex");
  if (event.httpMethod === "HEAD") delete response.body;
  return response;
}

function ensureCharacterEncoding(response, defaultEncoding = "UTF-8") {
  response.headers ||= {};

  let contentTypeHeader = Object.keys(response.headers).find(
    (name) => name.toLocaleLowerCase() == "content-type"
  );

  if (!contentTypeHeader) {
    contentTypeHeader = "Content-Type";
    response[contentTypeHeader] ||= "application/json; charset=UTF-8";
  }

  const value = parseHeader(response.headers[contentTypeHeader]);
  if (TextTypes.test(value[0]) & !value.charset) {
    response.headers[contentTypeHeader] += `; charset=${defaultEncoding}`;
  }
  return response;
}

function decodeEventBody(event) {
  if (!event.isBase64Encoded) return event;
  event.body = Buffer.from(event.body, "base64").toString("utf8");
  event.isBase64Encoded = false;
  return event;
}

function getEventToken(event) {
  const bearerRe = /^Bearer (?<token>.+)$/;
  const result = bearerRe.exec(event.headers.authorization);
  return result?.groups?.token || event.cookieObject[apiTokenName()];
}

function decodeToken(event) {
  const existingToken = getEventToken(event);

  try {
    event.userToken = new ApiToken(existingToken);
  } catch (error) {
    event.userToken = new ApiToken();
  }
  if (isFromReadingRoom(event)) {
    event.userToken.readingRoom();
  }

  return event;
}

function encodeToken(event, response) {
  if (event.userToken.updated()) {
    let cookieOptions = {
      domain: "library.northwestern.edu",
      path: "/",
      secure: true,
    };
    if (event.userToken.shouldExpire()) cookieOptions.expires = new Date(0);
    const newCookie = cookie.serialize(
      apiTokenName(),
      event.userToken.sign(),
      cookieOptions
    );

    response.cookies =
      Object.prototype.hasOwnProperty.call(response, "cookies") &&
      _.isArray(response.cookies)
        ? response.cookies
        : [];
    response.cookies.push(newCookie);
  }
  return response;
}

function isApiGateway(event) {
  return gatewayRe.test(event.requestContext.domainName);
}

function isDefaultRoute(event) {
  return event.routeKey.match(/\$default$/);
}

function isLocal(event) {
  return event.requestContext.domainName === "localhost";
}

function normalizeHeaders(event) {
  if (event.normalizedHeaders) return event;

  const headers = { ...event.headers };

  for (const header in headers) {
    const lowerHeader = header.toLowerCase();
    if (header != lowerHeader) {
      const value = headers[header];
      delete headers[header];
      headers[lowerHeader] = value;
    }
  }

  event.headers = headers;
  event.normalizedHeaders = true;
  return event;
}

function baseUrl(event) {
  event = normalizeHeaders(event);

  // For use with the local https-proxy in dev mode
  if (event.headers["x-forwarded-base"])
    return event.headers["x-forwarded-base"];

  const scheme = event.headers["x-forwarded-proto"];

  // The localhost check only matters in dev mode, but it's
  // really inconvenient not to have it
  const host = isLocal(event)
    ? event.headers["host"].split(/:/)[0]
    : event.requestContext.domainName;
  const port = event.headers["x-forwarded-port"];

  let result = new URL(`${scheme}://${host}:${port}`);

  let stem;
  if (isApiGateway(event) && !isDefaultRoute(event)) {
    const routeKey = event.routeKey.split(" ")[1];
    const routeRe = new RegExp(
      "^(.*)" + routeKey.replace(/\{.+?\}/g, ".+?") + "$"
    );
    stem = routeRe.exec(event.rawPath)[1];
  } else if (!isLocal(event) && event?.stageVariables?.basePath) {
    stem = event.stageVariables.basePath;
  } else {
    stem = "";
  }

  result = new URL(`${stem}/`, result);
  return result.toString();
}

function effectivePath(event) {
  const root = path.join("/", event.requestContext.stage);
  const absolute = event.requestContext.http.path;
  return path.relative(root, absolute);
}

function objectifyCookies(event) {
  event.cookieObject = {};
  if (!event.cookies) return event;
  const cookieRe = /^(?<name>.+?)=(?<value>.+)$/;
  for (const cookie of event.cookies) {
    const match = cookieRe.exec(cookie);
    if (match) {
      const { name, value } = match.groups;
      event.cookieObject[name] = value;
    }
  }
  return event;
}

function isFromReadingRoom(event) {
  const AllowedIPs = (process.env.READING_ROOM_IPS || "").split(/\s*,\s*/);
  const sourceIp = event.requestContext?.http?.sourceIp;
  return AllowedIPs.includes(sourceIp);
}

function maybeUseProxiedIp(event) {
  if (!!process.env.USE_PROXIED_IP && event.headers?.["x-client-ip"]) {
    event.requestContext.http.sourceIp = event.headers["x-client-ip"];
  }
  return event;
}

function stubEventMembers(event) {
  event.headers ||= {};
  event.pathParameters ||= {};
  event.queryStringParameters ||= {};
  event.stageVariables ||= {};
  event.cookies ||= [];
  return event;
}

module.exports = {
  addCorsHeaders,
  addEtag,
  baseUrl,
  decodeEventBody,
  decodeToken,
  encodeToken,
  effectivePath,
  ensureCharacterEncoding,
  isFromReadingRoom,
  maybeUseProxiedIp,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
};
