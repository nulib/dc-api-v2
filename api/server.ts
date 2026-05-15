#!/usr/bin/env bun

/**
 * Local development server — mirrors the SAM route table.
 *
 * Usage:
 *   bun server.ts
 *
 * Env vars are loaded from ../env.json (Parameters key) if present.
 * Override any key by setting it in the environment before running.
 * Port defaults to 3000; override with PORT=XXXX.
 */

// ── Load env.json before handlers import ────────────────────────────────────
try {
  const raw = await Bun.file(new URL("../env.json", import.meta.url)).text();
  const params: Record<string, string> = JSON.parse(raw)?.Parameters ?? {};
  for (const [k, v] of Object.entries(params)) {
    process.env[k] = String(v);
  }
} catch {
  // env.json absent or malformed — rely on real env vars
}

// ── App ──────────────────────────────────────────────────────────────────────
import { Hono } from "hono";
import app from "./src/app.ts";

// ── Server ───────────────────────────────────────────────────────────────────

const mount = new Hono();
mount.route("/api/v2", app);

const port = Number(process.env["PORT"] ?? 3000);
const tls = process.env["SSL_CERT"]
  ? {
      cert: Bun.file(process.env["SSL_CERT"]),
      key: Bun.file(process.env["SSL_KEY"] ?? "")
    }
  : undefined;
const SCHEME = tls ? "https" : "http";
const hostname = process.env["HOST"] ?? "localhost";

// idleTimeout: 0 disables the timeout entirely — useful when paused at a breakpoint
const idleTimeout = process.env["TIMEOUT"]
  ? Number(process.env["TIMEOUT"])
  : undefined;

const server = Bun.serve({
  hostname,
  port,
  tls,
  idleTimeout,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const response = await mount.fetch(req);
    console.log(
      `${req.method} ${url.pathname}${url.search} → ${response.status}`
    );
    return response;
  }
});

console.log(
  `dc-api-v2 dev server listening on ${SCHEME}://${hostname}:${server.port}`
);
