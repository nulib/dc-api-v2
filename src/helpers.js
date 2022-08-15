const gatewayRe = /execute-api.[a-z]+-[a-z]+-\d+.amazonaws.com/;

function baseUrl(event) {
  const scheme = event.headers["X-Forwarded-Proto"];

  // The localhost check only matters in dev mode, but it's
  // really inconvenient not to have it
  const host =
    event.requestContext.domainName === "localhost"
      ? event.headers["Host"].split(/:/)[0]
      : event.requestContext.domainName;
  const port = event.headers["X-Forwarded-Port"];

  let result = new URL(`${scheme}://${host}:${port}`);
  const stage = event.requestContext?.stage;

  if (gatewayRe.test(result.host) && stage !== "$default") {
    result = new URL(`${stage}/`, result);
  }
  return result.toString();
}

module.exports = { baseUrl };
