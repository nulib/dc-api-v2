const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const PackageInfo = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"))
);

function apiToken() {
  const token = {
    displayName: ["Digital Collection API v2"],
    iat: Math.floor(Number(new Date()) / 1000),
  };

  return jwt.sign(token, apiTokenSecret());
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

function defaultSearchSize() {
  return Number(process.env.DEFAULT_SEARCH_SIZE || "10");
}

function devTeamNetIds() {
  return process.env.DEV_TEAM_NET_IDS?.split(",") || [];
}

function openSearchEndpoint() {
  return process.env.OPENSEARCH_ENDPOINT;
}

function prefix(value) {
  const envPrefix =
    process.env.ENV_PREFIX === "" ? undefined : process.env.ENV_PREFIX;
  return [envPrefix, value].filter((val) => !!val).join("-");
}

function ProviderCapabilities() {
  return JSON.parse(process.env.PROVIDER_CAPABILITIES);
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
  defaultSearchSize,
  devTeamNetIds,
  openSearchEndpoint,
  prefix,
  ProviderCapabilities,
  region,
};
