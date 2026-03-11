import {
  GetSecretValueCommand,
  SecretsManagerClient
} from "@aws-sdk/client-secrets-manager";

let Secrets: Record<string, Record<string, string>> = {};
const SECRETS_PATH = process.env?.SECRETS_PATH;

const loadSecrets = async (secretIds: string[]) => {
  const client = new SecretsManagerClient({});
  for (const secretId of secretIds) {
    if (!Secrets[secretId]) {
      try {
        const cmd = new GetSecretValueCommand({
          SecretId: `${SECRETS_PATH}/infrastructure/${secretId}`
        });
        const secretsResponse = await client.send(cmd);
        if (secretsResponse.SecretString) {
          Secrets[secretId] = JSON.parse(secretsResponse.SecretString);
        }
      } catch (err) {
        console.error(`Error loading ${secretId} from secrets manager`, err);
      }
    }
  }
};

await loadSecrets(["index", "iiif"]);

export const DC_API_BASE =
  process.env.DC_API_BASE || "https://api.dc.library.northwestern.edu/api/v2";
export const DC_IIIF_BASE = process.env.DC_IIIF_BASE || Secrets.iiif.v3;
export const VIEWER_PATH = process.env.VIEWER_PATH || "dist/apps/viewer";
export const SEARCH_MODEL_ID =
  process.env.SEARCH_MODEL_ID || Secrets.index.embedding_model;

console.log("MCP Config: %o", {
  DC_API_BASE,
  DC_IIIF_BASE,
  VIEWER_PATH,
  SEARCH_MODEL_ID
});
