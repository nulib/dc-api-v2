/**
 * Entry point for running the MCP server locally.
 * Run with: node dist/index.js [--stdio]
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { McpHttpHandler } from "@modelcontextprotocol/server";
import cors from "cors";
import express from "express";
import type { Express, Request as ExpressRequest, Response } from "express";
import { createServer } from "../server.js";
import { mcpHandler } from "./mcpHandler.js";

export async function toWebRequest(req: ExpressRequest): Promise<Request> {
  const protocol = req.headers["x-forwarded-proto"] ?? req.protocol ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    init.body = Buffer.concat(chunks);
  }

  return new Request(url, init);
}

/**
 * Builds the Express app that bridges HTTP requests to the MCP handler.
 * Serves both 2026-07-28 and legacy (2025-era) protocol clients.
 */
export function createApp(handler: McpHttpHandler = mcpHandler): Express {
  const app = express();
  app.use(cors());

  app.all("/mcp", async (req: ExpressRequest, res: Response) => {
    try {
      const response = await handler.fetch(await toWebRequest(req));
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        for await (const chunk of response.body) {
          res.write(chunk);
        }
      }
      res.end();
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      } else {
        res.end();
      }
    }
  });

  return app;
}

/**
 * Starts an MCP server with Streamable HTTP transport in stateless mode.
 */
export async function startStreamableHTTPServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  const httpServer = createApp().listen(port, (err) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main() {
  if (process.argv.includes("--stdio")) {
    serveStdio(createServer);
  } else {
    await startStreamableHTTPServer();
  }
}

const isEntrypoint = import.meta.main === undefined ? true : import.meta.main;

if (isEntrypoint) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
