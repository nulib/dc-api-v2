import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "../server.js";

/**
 * Fetch-style (Request → Response) MCP handler shared by the Lambda and
 * local Express entry points. Creates a fresh server per request and serves
 * both the 2026-07-28 protocol revision and legacy (2025-era) clients,
 * including SEP-2243 standard header validation (Mcp-Method, Mcp-Name,
 * MCP-Protocol-Version).
 */
export const mcpHandler = createMcpHandler(createServer);
