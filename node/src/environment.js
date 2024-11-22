const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require("@aws-sdk/client-secrets-manager");
const PackageInfo = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"))
);

const { SECRETS_PATH } = process.env;
const SecretIds = {
  index: `${SECRETS_PATH}/infrastructure/index`,
  meadow: "config/meadow",
};
let Initialized = false;
let Secrets = {};

async function initialize() {
  if (Initialized) return;

  const client = new SecretsManagerClient();
  for (const source in SecretIds) {
    const SecretId = SecretIds[source];
    console.debug("loading", SecretId, "from", source);
    const cmd = new GetSecretValueCommand({ SecretId });
    const { SecretString } = await client.send(cmd);
    Secrets[source] = JSON.parse(SecretString);
  }
  Initialized = true;
  return Secrets;
}

function apiToken() {
  const token = {
    displayName: ["Digital Collection API v2"],
    iat: Math.floor(Number(new Date()) / 1000),
  };

  return jwt.sign(token, process.env.API_TOKEN_SECRET);
}

function apiTokenName() {
  return process.env.API_TOKEN_NAME;
}

function apiTokenSecret() {
  return process.env.API_TOKEN_SECRET;
}

function appInfo(options = {}) {
  return {
    name: PackageInfo.name,
    description: PackageInfo.description,
    version: PackageInfo.version,
    link_expiration: options.expires || null,
  };
}

function dcApiEndpoint() {
  return process.env.DC_API_ENDPOINT;
}

function dcUrl() {
  return process.env.DC_URL;
}

function devTeamNetIds() {
  return process.env.DEV_TEAM_NET_IDS.split(",");
}

function openSearchEndpoint() {
  return process.env.OPENSEARCH_ENDPOINT;
}

function prefix(value) {
  const envPrefix =
    process.env.ENV_PREFIX === "" ? undefined : process.env.ENV_PREFIX;
  return [envPrefix, value].filter((val) => !!val).join("-");
}

function region() {
  return process.env.AWS_REGION || "us-east-1";
}

module.exports = {
  apiToken,
  apiTokenName,
  apiTokenSecret,
  appInfo,
  dcApiEndpoint,
  dcUrl,
  devTeamNetIds,
  initialize,
  openSearchEndpoint,
  prefix,
  region,
};
