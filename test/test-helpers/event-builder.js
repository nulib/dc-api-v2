const base64 = require("base64-js");

module.exports = class {
  constructor(method, route) {
    const now = new Date();
    this.event = {
      version: "2.0",
      routeKey: route,
      rawPath: route,
      rawQueryString: "",
      cookies: [],
      headers: {
        Host: "api.test.library.northwestern.edu",
        "X-Forwarded-For": "127.0.0.1, 127.0.0.2",
        "X-Forwarded-Port": "443",
        "X-Forwarded-Proto": "https",
      },
      queryStringParameters: {},
      requestContext: {
        accountId: "123456789012",
        apiId: "pewpew",
        domainName: "api.test.library.northwestern.edu",
        domainPrefix: "api",
        http: {
          method: method,
          path: route,
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "Mocha Test",
        },
        requestId: "id",
        routeKey: route,
        stage: "v2",
        time: now.toISOString(),
        timeEpoch: Number(now),
      },
      body: "",
      pathParameters: {},
      isBase64Encoded: false,
      stageVariables: {},
    };
  }

  body(body) {
    switch (typeof body) {
      case "undefined":
        this.event.body = {};
      case "object":
        this.event.body = JSON.stringify(body);
    }
    return this;
  }

  headers(headers) {
    Object.assign(this.event.headers, headers);
    return this;
  }

  pathParams(params) {
    this.event.pathParameters = params;
    this.event.rawPath = this.event.routeKey;
    for (const param in params) {
      this.event.rawPath = this.event.rawPath.replace(
        `{${param}}`,
        params[param]
      );
    }
    return this;
  }

  queryParams(params) {
    this.event.queryStringParameters = params;
    this.event.rawQueryString = new URLSearchParams(params).toString();
    return this;
  }

  base64Encode() {
    if (this.event.isBase64Encoded) return this;
    this.event.isBase64Encoded = true;
    this.event.body = base64.fromByteArray(new Buffer.from(this.event.body));
    return this;
  }
};
