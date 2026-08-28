/**
 * Minimal client observability for the stateless MCP server.
 *
 * Two log lines, both single-line JSON for CloudWatch Insights:
 *
 * - `[mcp.request]` — once per served HTTP request (the server factory runs
 *   per request in stateless mode), covering connect/introspect traffic:
 *   who is calling (user agent, source IP) and what they asked for
 *   (the SEP-2243 `Mcp-Method`/`Mcp-Name` headers).
 * - `[mcp.tool]` — once per tool invocation, with the self-reported client
 *   identity from the per-request `_meta` envelope and the tool arguments.
 *
 * Client identity is self-reported and is for display/logging only — never
 * base behavior or authorization on it.
 */
import type {
  McpRequestContext,
  ServerContext
} from "@modelcontextprotocol/server";

/** `_meta` key carrying the calling client's self-reported name/version. */
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";

/** Cap on the serialized tool arguments written to the log line. */
const MAX_ARGS_LENGTH = 500;

type ClientInfo = { name?: string; version?: string };

const compact = (entries: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(entries).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

const emit = (tag: string, entries: Record<string, unknown>) =>
  console.info(tag, JSON.stringify(compact(entries)));

/** API Gateway appends proxy hops; the client address is the first entry. */
const clientIp = (forwardedFor: string | null | undefined) =>
  forwardedFor?.split(",")[0]?.trim();

const describeClient = (info: ClientInfo | undefined) =>
  info?.name ? [info.name, info.version].filter(Boolean).join("/") : undefined;

const truncate = (value: string) =>
  value.length > MAX_ARGS_LENGTH
    ? `${value.slice(0, MAX_ARGS_LENGTH)}…`
    : value;

/**
 * Logs one line per served request. Called from the server factory, so it
 * sees every HTTP request (modern and legacy) but nothing over stdio, where
 * there is no HTTP request to describe.
 */
export const logRequest = (ctx?: McpRequestContext) => {
  const headers = ctx?.requestInfo?.headers;
  if (!headers) return;

  emit("[mcp.request]", {
    era: ctx?.era,
    // SEP-2243 standard headers; absent for legacy (2025-era) clients.
    // `Mcp-Name` names the targeted primitive (e.g. the tool being called).
    method: headers.get("mcp-method"),
    target: headers.get("mcp-name"),
    protocol: headers.get("mcp-protocol-version"),
    userAgent: headers.get("user-agent"),
    origin: headers.get("origin"),
    ip: clientIp(headers.get("x-forwarded-for")),
    authenticated: headers.has("authorization") || undefined
  });
};

const clientInfoFrom = (ctx?: ServerContext): ClientInfo | undefined => {
  const meta = ctx?.mcpReq as
    | { envelope?: Record<string, unknown>; _meta?: Record<string, unknown> }
    | undefined;
  return (meta?.envelope?.[CLIENT_INFO_META_KEY] ??
    meta?._meta?.[CLIENT_INFO_META_KEY]) as ClientInfo | undefined;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Wraps a tool handler so every invocation logs the tool name, the calling
 * client, and the (truncated) arguments. The wrapper is transparent: all
 * arguments and the return value pass straight through.
 */
export const withToolLogging = <H extends (...args: any[]) => any>(
  toolName: string,
  handler: H
): H =>
  ((...args: any[]) => {
    // Tools with an input schema are called as (args, ctx); tools without
    // one are called as (ctx) alone.
    const hasInput = args.length > 1 || !(args[0] as any)?.mcpReq;
    const input = hasInput ? args[0] : undefined;
    const ctx = (hasInput ? args[1] : args[0]) as ServerContext | undefined;

    emit("[mcp.tool]", {
      tool: toolName,
      client: describeClient(clientInfoFrom(ctx)),
      args: input === undefined ? undefined : truncate(JSON.stringify(input))
    });

    return handler(...args);
  }) as H;
/* eslint-enable @typescript-eslint/no-explicit-any */
