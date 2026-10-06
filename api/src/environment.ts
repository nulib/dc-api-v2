import { SignJWT } from "jose";
import PackageInfo from "../package.json" with { type: "json" };

export async function apiToken(): Promise<string> {
  const token = {
    displayName: ["Digital Collection API v2"],
    iat: Math.floor(Number(new Date()) / 1000),
  };
  return await new SignJWT(token as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode(apiTokenSecret()));
}

export function apiTokenName(): string {
  return process.env["API_TOKEN_NAME"] ?? "";
}

export function apiTokenSecret(): string {
  return process.env["API_TOKEN_SECRET"] ?? "";
}

// The `info` block of every JSON response. It is part of the bytes a C2PA
// manifest is bound to (see `documentBody`), so on `GET /works/{id}` it must
// not vary between requests: `link_expiration` is only set by the shared-link
// route, which is never the signed asset. Add nothing here that depends on
// the request (time, token, caller).
export function appInfo(
  options: { expires?: Date | number | null } = {},
): Record<string, unknown> {
  return {
    name: PackageInfo.name,
    description: PackageInfo.description,
    version: PackageInfo.version,
    link_expiration: options.expires ?? null,
  };
}

export type C2paCredentials = {
  certificate: string;
  key: string;
  tsaUrl?: string;
};

// PEM values that have passed through an env file or JSON config often have
// their newlines flattened into literal "\n" sequences.
function pem(value: string | undefined): string {
  return (value ?? "").replace(/\\n/g, "\n");
}

export function c2paCredentials(): C2paCredentials | null {
  const certificate = pem(process.env["C2PA_CERTIFICATE"]);
  const key = pem(process.env["C2PA_KEY"]);
  if (!certificate || !key) return null;
  return {
    certificate,
    key,
    tsaUrl: process.env["C2PA_TSA_URL"] || undefined,
  };
}

export function dcApiEndpoint(): string {
  return process.env["DC_API_ENDPOINT"] ?? "";
}

export function dcUrl(): string {
  return process.env["DC_URL"] ?? "";
}

export function defaultSearchSize(): number {
  return Number(process.env["DEFAULT_SEARCH_SIZE"] ?? "10");
}

export function devTeamNetIds(): string[] {
  return process.env["DEV_TEAM_NET_IDS"]?.split(",") ?? [];
}

export function openSearchEndpoint(): string {
  return process.env["OPENSEARCH_ENDPOINT"] ?? "";
}

export function prefix(value: string): string {
  const envPrefix = process.env["ENV_PREFIX"] || undefined;
  return [envPrefix, value].filter((val) => !!val).join("-");
}

export function ProviderCapabilities(): Record<string, unknown> {
  return JSON.parse(process.env["PROVIDER_CAPABILITIES"] ?? "{}");
}

export function region(): string {
  return process.env["AWS_REGION"] ?? "us-east-1";
}
