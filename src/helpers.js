const gatewayRe = /execute-api.[a-z]+-[a-z]+-\d+.amazonaws.com/;

function isApiGateway(event) {
  return gatewayRe.test(event.requestContext.domainName);
}

function isDefaultRoute(event) {
  return event.routeKey.match(/\$default$/);
}

function isLocal(event) {
  return event.requestContext.domainName === "localhost";
}

function getHeader(event, name) {
  return event.headers[name] || event.headers[name.toLowerCase()];
}

function baseUrl(event) {
  const scheme = getHeader(event, "X-Forwarded-Proto");

  // The localhost check only matters in dev mode, but it's
  // really inconvenient not to have it
  const host = isLocal(event)
    ? getHeader(event, "Host").split(/:/)[0]
    : event.requestContext.domainName;
  const port = getHeader(event, "X-Forwarded-Port");

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

module.exports = { baseUrl, getHeader };
