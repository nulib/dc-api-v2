import type { APIGatewayProxyEventV2 } from "aws-lambda";

/**
 * Builds a synthetic API Gateway v2 event for exercising the Lambda MCP
 * handler in-process.
 */
export function makeEvent({
  method = "POST",
  headers = {},
  body
}: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/mcp",
    rawQueryString: "",
    headers: {
      host: "api.test.library.northwestern.edu",
      "x-forwarded-proto": "https",
      ...headers
    },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "api.test.library.northwestern.edu",
      domainPrefix: "api",
      http: {
        method,
        path: "/mcp",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "bun-test"
      },
      requestId: "test-request-id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 1767225600000
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false
  } as APIGatewayProxyEventV2;
}

/**
 * Builds a JSON-RPC request body carrying the 2026-07-28 protocol version
 * envelope, plus the matching SEP-2243 standard headers.
 */
export function makeModernRequest(
  method: string,
  params: Record<string, unknown> = {},
  { name }: { name?: string } = {}
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-method": method,
    "mcp-protocol-version": "2026-07-28"
  };
  if (name) headers["mcp-name"] = name;

  return {
    headers,
    body: {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "lambda-test-client",
            version: "1.0.0"
          },
          ...(params._meta as Record<string, unknown> | undefined)
        }
      }
    }
  };
}

/**
 * Parses a Lambda response body that may be plain JSON or a single-message
 * SSE stream ("event: message\ndata: {...}").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonRpcBody(body: string | undefined): any {
  if (!body) return undefined;
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const messages = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
  return messages.length === 1 ? messages[0] : messages;
}
