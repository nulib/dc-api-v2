import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context
} from "aws-lambda";
import type { McpHttpHandler } from "@modelcontextprotocol/server";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Method, Mcp-Name, MCP-Protocol-Version"
};

export const streamableHttpHandler = (mcpHandler: McpHttpHandler) => {
  return async (
    event: APIGatewayProxyEventV2,
    _context: Context
  ): Promise<APIGatewayProxyResultV2> => {
    if (event.requestContext.http.method === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }

    try {
      const res = await mcpHandler.fetch(makeRequest(event));
      return {
        statusCode: res.status,
        headers: {
          ...Object.fromEntries(res.headers.entries()),
          ...corsHeaders
        },
        body: await res.text()
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
};
