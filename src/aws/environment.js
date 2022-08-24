const jwt = require("jsonwebtoken");

function apiToken() {
  const token = {
    displayName: ["Digital Collection API v2"],
    iat: Math.floor(Number(new Date()) / 1000),
  };

  return jwt.sign(token, process.env.API_TOKEN_SECRET);
}

function elasticsearchEndpoint() {
  return process.env.ELASTICSEARCH_ENDPOINT;
}

function prefix(value) {
  const envPrefix =
    process.env.ENV_PREFIX === "" ? undefined : process.env.ENV_PREFIX;
  return [envPrefix, value].filter((val) => !!val).join("-");
}

function region() {
  return process.env.AWS_REGION || "us-east-1";
}

module.exports = { apiToken, elasticsearchEndpoint, prefix, region };
