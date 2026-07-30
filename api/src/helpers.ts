import { apiTokenName } from "./environment.ts";
import { ApiToken } from "./api/api-token.ts";
import { Context } from "hono";

export const AcceptableHeaders = [
  "Accept",
  "Accept-Charset",
  "Accept-Encoding",
  "Accept-Language",
  "Accept-Datetime",
  "Authorization",
  "Cache-Control",
  "Content-Length",
  "Content-Type",
  "Cookie",
  "Date",
  "Expect",
  "Host",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
  "Origin",
  "Pragma",
  "Range",
  "Referer",
  "User-Agent",
  "X-CSRF-Token",
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Forwarded-Port",
  "X-Requested-With",
];

export const ExposedHeaders = [
  "Cache-Control",
  "Content-Language",
  "Content-Length",
  "Content-Type",
  "Date",
  "ETag",
  "Expires",
  "Last-Modified",
  "Pragma",
  "Vary",
];

export async function decodeToken(c: Context): Promise<ApiToken> {
  const bearerRe = /^Bearer (?<token>.+)$/;
  const auth = c.req.header("authorization") ?? "";
  const bearerToken = bearerRe.exec(auth)?.groups?.token;
  // Parse the cookie header to find the API token cookie
  const cookieHeader = c.req.header("cookie") ?? "";
  const cookieToken = parseCookieToken(cookieHeader, apiTokenName());
  return await ApiToken.create(bearerToken ?? cookieToken);
}

function parseCookieToken(
  cookieHeader: string,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key.trim() === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function isFromReadingRoom(sourceIp: string): boolean {
  const AllowedIPs = process.env["READING_ROOM_IPS"]?.split(/\s*,\s*/);
  if (sourceIp === "" || !AllowedIPs || AllowedIPs.length === 0) return false;
  return AllowedIPs.includes(sourceIp);
}

export function baseUrl(c: Context): string {
  if (c.req.header("x-forwarded-base")) {
    return c.req.header("x-forwarded-base") as string;
  }
  const url = new URL(c.req.url);
  url.search = "";
  url.pathname = "/api/v2/";
  return url.toString();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function effectivePath(c: Context): string {
  const pathname = new URL(c.req.url).pathname;
  const root = "/api/v2/";
  return pathname.startsWith(root)
    ? pathname.slice(root.length).replace(/^\//, "")
    : pathname.replace(/^\//, "");
}
