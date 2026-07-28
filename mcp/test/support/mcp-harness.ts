/**
 * MCP test harness
 *
 * Connects a v2 MCP client to the server through `createMcpHandler` — the
 * same fetch-style handler the Lambda and Express entry points use — via an
 * in-process `fetchFn` (no network, so MSW only sees the server's outbound
 * Digital Collections API calls). The client pins the 2026-07-28 protocol
 * revision so tests exercise the stateless protocol this server targets.
 */
import {
  Client,
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/client";
import {
  createMcpHandler,
  type McpServerFactory
} from "@modelcontextprotocol/server";

export interface McpTestContext {
  client: Client;
  cleanup: () => Promise<void>;
}

/**
 * Creates a test context with MCP server and client
 *
 * The factory parameter is loosely typed: apps/mcp is ESM while tests
 * resolve CommonJS typings, so the two module graphs see different nominal
 * McpServer identities even though the runtime class is the same.
 */
export async function createTestContext(
  createServer: () => unknown
): Promise<McpTestContext> {
  const handler = createMcpHandler(createServer as McpServerFactory);

  // handler.fetch takes a Request object, not the (url, init) fetch call
  // shape the client transport uses — normalize before handing off.
  const normalizingFetch = (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> =>
    handler.fetch(input instanceof Request ? input : new Request(input, init));

  const transport = new StreamableHTTPClientTransport(
    new URL("http://mcp.test/mcp"),
    { fetch: normalizingFetch }
  );

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0"
    },
    {
      versionNegotiation: { mode: { pin: "2026-07-28" } }
    }
  );

  await client.connect(transport);

  const cleanup = async () => {
    await client.close();
    await handler.close();
  };

  return { client, cleanup };
}
