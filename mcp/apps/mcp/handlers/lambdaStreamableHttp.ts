import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context
} from "aws-lambda";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function makeRequest(event: APIGatewayProxyEventV2): Request {
  const headers = new Headers();
  if (event.headers) {
    for (const [k, v] of Object.entries(event.headers)) {
      if (v !== undefined) headers.set(k, v as string);
    }
  }

  const protocol = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("host") ?? "localhost";

  let url = `${protocol}://${host}${event.rawPath}`;
  if (event?.rawQueryString !== "") {
    url = `${url}?${event.rawQueryString}`;
  }

  const request: RequestInit = {
    method: event.requestContext.http.method,
    headers,
    body: null
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    request.body = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body
      : undefined;
  }

  return new Request(url, request);
}

export const streamableHttpHandler = (server: McpServer) => {
  return async (
    event: APIGatewayProxyEventV2,
    _context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined // stateless
    });

    try {
      const req = makeRequest(event);
      await server.connect(transport);
      const res = await transport.handleRequest(req);
      return {
        statusCode: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text()
      };
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      transport.close();
      server.close();
    }
  };
};
