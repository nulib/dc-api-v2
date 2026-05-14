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
