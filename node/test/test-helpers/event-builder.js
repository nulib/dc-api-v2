const sortJson = require("sort-json");

class EventBuilder {
  constructor(method, route) {
    const now = new Date();
    this._method = method;
    this._route = route;

    this._event = {
      version: "2.0",
      routeKey: `${method} ${route}`,
      rawPath: `/v2${route}`,
      rawQueryString: "",
      headers: {
        Host: "api.test.library.northwestern.edu",
        "X-Forwarded-For": "10.9.8.7, 10.6.5.4",
        "X-Forwarded-Port": "443",
        "X-Forwarded-Proto": "https",
      },
      requestContext: {
        accountId: "123456789012",
        apiId: "pewpew",
        domainName: "api.test.library.northwestern.edu",
        domainPrefix: "api",
        http: {
          method: method,
          path: `/v2${route}`,
          protocol: "HTTP/1.1",
          sourceIp: "10.9.8.7",
          userAgent: "Mocha Test",
        },
        requestId: "id",
        routeKey: `${method} ${route}`,
        stage: "v2",
        time: now.toISOString(),
        timeEpoch: Number(now),
      },
      body: "",
      stageVariables: { basePath: "api/v2" },
      isBase64Encoded: false,
    };
  }

  body(body) {
    return this.update((copy) => {
      switch (typeof body) {
        case "string":
          copy._event.body = body;
          break;
        case "undefined":
          copy._event.body = "";
          break;
        case "object":
          copy._event.body = JSON.stringify(body);
          break;
      }
    });
  }

  headers(headers) {
    return this.update((copy) => {
      Object.assign(copy._event.headers, headers);
    });
  }

  pathParams(params) {
    return this.update((copy) => {
      copy._pathParams = params;
    });
  }

  queryParams(params) {
    return this.update((copy) => {
      copy._queryParams = params;
    });
  }

  stageVariables(vars) {
    return this.update((copy) => {
      copy._event.stageVariables = vars;
    });
  }

  base64Encode() {
    return this.update((copy) => {
      copy._base64Encode = true;
    });
  }

  cookie(name, value) {
    return this.update((copy) => {
      if (!copy._event.cookies) copy._event.cookies = [];
      copy._event.cookies.push(`${name}=${encodeURIComponent(value)}`);
    });
  }

  update(func) {
    let result = new EventBuilder();
    result = Object.assign(result, this);
    func(result);
    return result;
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

    result.requestContext.http.path = result.rawPath;

    if (this._pathParams) {
      result.pathParameters = { ...this._pathParams };
      for (const param in result.pathParameters) {
        result.rawPath = result.rawPath.replace(
          `{${param}}`,
          result.pathParameters[param]
        );
      }
    }

    if (this._queryParams) {
      result.queryStringParameters = { ...this._queryParams };
      result.rawQueryString = new URLSearchParams(
        result.queryStringParameters
      ).toString();
    }

    return sortJson(result);
  }
}

module.exports = EventBuilder;
