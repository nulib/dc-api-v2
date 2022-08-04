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

module.exports = { elasticsearchEndpoint, prefix, region };
