/**
 * Simpler test setup using openapi-fetch's custom fetch option
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpTestContext {
  client: Client;
  server: McpServer;
  cleanup: () => Promise<void>;
}

/**
 * Creates a test context with MCP server and client
 */
export async function createTestContext(
  createServer: () => McpServer
): Promise<McpTestContext> {
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  const cleanup = async () => {
    await Promise.all([client.close(), server.close()]);
  };

  return { client, server, cleanup };
}
