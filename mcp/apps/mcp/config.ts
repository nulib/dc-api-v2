/// <reference types="vite/client" />
import {
  GetSecretValueCommand,
  SecretsManagerClient
} from "@aws-sdk/client-secrets-manager";

const getEnvVar = (key: string, ...defaults: string[]): string => {
  const result =
    process.env[key] ||
    process.env[`VITE_${key}`] ||
    import.meta?.env?.[key] ||
    import.meta?.env?.[`VITE_${key}`] ||
    defaults.find((d) => d !== undefined);
  return result;
};

let Secrets: Record<string, Record<string, any>> = {};
const SECRETS_PATH = getEnvVar("SECRETS_PATH");

const loadSecrets = async (secretIds: string[]) => {
  if (!SECRETS_PATH) {
    return;
  }
  const client = new SecretsManagerClient();
  for (const secretId of secretIds) {
    if (!Secrets[secretId]) {
      try {
        const cmd = new GetSecretValueCommand({
          SecretId: `${SECRETS_PATH}/${secretId}`
        });
        const secretsResponse = await client.send(cmd);
        if (secretsResponse.SecretString) {
          const secretKey = secretId.split("/").slice(-1)[0];
          Secrets[secretKey] = JSON.parse(secretsResponse.SecretString);
        }
      } catch (err) {
        console.error(`Error loading ${secretId} from secrets manager`, err);
      }
    }
  }
};

await loadSecrets(["infrastructure/iiif", "config/dcapi", "config/meadow"]);

const ensureTrailingBackslash = (url: string) =>
  url.endsWith("/") ? url : url + "/";

export const DC_API_BASE = ensureTrailingBackslash(
  getEnvVar(
    "DC_API_BASE",
    Secrets.dcapi?.base_url,
    "https://api.dc.library.northwestern.edu/api/v2"
  )
);
export const DC_API_ORIGIN = new URL(DC_API_BASE).origin;
export const DC_IIIF_BASE = ensureTrailingBackslash(
  getEnvVar(
    "DC_IIIF_BASE",
    Secrets.iiif?.v3,
    "https://iiif.dc.library.northwestern.edu/iiif/3"
  )
);
export const DC_IIIF_ORIGIN = new URL(DC_IIIF_BASE).origin;

export const DC_STREAMING_BASE = ensureTrailingBackslash(
  getEnvVar(
    "DC_STREAMING_BASE",
    Secrets.meadow?.streaming?.base_url,
    "https://meadow-streaming.rdc.library.northwestern.edu/"
  )
);

export const DC_STREAMING_ORIGIN = DC_STREAMING_BASE
  ? new URL(DC_STREAMING_BASE).origin
  : undefined;

export const DC_RESOURCE_ORIGINS = [
  DC_API_ORIGIN,
  DC_IIIF_ORIGIN,
  DC_STREAMING_ORIGIN
].filter((origin): origin is string => !!origin);

export const DEBUG = getEnvVar("DEBUG", "false").toLowerCase() === "true";
