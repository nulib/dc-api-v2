module.exports = class {
  constructor(method, route) {
    const now = new Date();
    this._method = method;
    this._pathPrefix = "";
    this._route = route;
    this._event = {
      version: "2.0",
      routeKey: `${method} ${route}`,
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
        routeKey: `${method} ${route}`,
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

  pathPrefix(prefix) {
    this._pathPrefix = prefix;
    return this;
  }

  body(body) {
    switch (typeof body) {
      case "string":
        this._event.body = body;
        break;
      case "undefined":
        this._event.body = "";
        break;
      case "object":
        this._event.body = JSON.stringify(body);
        break;
    }
    return this;
  }

  headers(headers) {
    Object.assign(this._event.headers, headers);
    return this;
  }

  pathParams(params) {
    this._pathParams = params;
    return this;
  }

  queryParams(params) {
    this._queryParams = params;
    return this;
  }

  stageVariables(vars) {
    this._event.stageVariables = vars;
    return this;
  }

  base64Encode() {
    this._base64Encode = true;
    return this;
  }

  render() {
    const result = { ...this._event };

    if (this._base64Encode) {
      result.isBase64Encoded = true;
      result.body = Buffer.from(result.body, "utf8").toString("base64");
    }

    const cookies = result.headers.cookie || result.headers.Cookie;
    if (cookies) {
      result.cookies = cookies.split(/;\s*/);
    }

    result.pathParameters = { ...this._pathParams };
    result.rawPath = this._pathPrefix + this._route;
    for (const param in result.pathParameters) {
      result.rawPath = result.rawPath.replace(
        `{${param}}`,
        result.pathParameters[param]
      );
    }
    result.requestContext.http.path = result.rawPath;

    result.queryStringParameters = { ...this._queryParams };
    result.rawQueryString = new URLSearchParams(
      result.queryStringParameters
    ).toString();

    return result;
  }
};
