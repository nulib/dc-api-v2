const base64 = require("base64-js");
const gatewayRe = /execute-api.[a-z]+-[a-z]+-\d+.amazonaws.com/;

function decodeEventBody(event) {
  if (!event.isBase64Encoded) return event;
  event.body = new Buffer.from(base64.toByteArray(event.body)).toString();
  event.isBase64Encoded = false;
  return event;
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

  for (header in headers) {
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

module.exports = { baseUrl, decodeEventBody, normalizeHeaders };
