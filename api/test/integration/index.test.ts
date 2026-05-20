import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { setupEnv, teardownEnv } from "../test-helpers/index.ts";
import { handler } from "../../src/index.ts";
import { LambdaEvent } from "hono/aws-lambda";

describe("lambda wrapper", () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("routes the request correctly", async () => {
    const TEST_EVENT: LambdaEvent = {
      version: "2.0",
      routeKey: "$default",
      rawPath: "/api/v2/auth/whoami",
      rawQueryString: "",
      cookies: [],
      headers: {
        host: "api.test.library.northwestern.edu",
      },
      queryStringParameters: {},
      requestContext: {
        requestId: "test-request-id",
        routeKey: "$default",
        accountId: "123456789012",
        apiId: "api-id",
        authorizer: {},
        domainName: "id.execute-api.us-east-1.amazonaws.com",
        domainPrefix: "id",
        authentication: null,
        http: {
          method: "GET",
          path: "/api/v2/auth/whoami",
          protocol: "HTTP/1.1",
          sourceIp: "192.168.0.109",
          userAgent: "agent",
        },
        stage: "v2",
        time: "12/Mar/2020:19:03:58 +0000",
        timeEpoch: 1583348638390,
      },
      body: "",
      pathParameters: {},
      isBase64Encoded: false,
      stageVariables: {},
    };

    const result = await handler(TEST_EVENT);
    expect(result.statusCode).toEqual(200);
    const response = JSON.parse(result.body);
    expect(response.isLoggedIn).toBe(false);
    expect("scopes" in response).toBe(true);
  });
});
