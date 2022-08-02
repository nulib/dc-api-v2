const AWS = require('aws-sdk');
const { awsFetch } = require('./aws-fetch');
const { prefix } = require("./environment");

const elasticsearchEndpoint = process.env.ELASTICSEARCH_ENDPOINT;
const region = process.env.AWS_REGION || "us-east-1";

async function getCollection(id) {
  return getDocument("dc-v2-collection", id);
}

async function getFileSet(id) {
  return getDocument("dc-v2-file-set", id);
}

async function getWork(id) {
  return getDocument("dc-v2-work", id);
}

async function getDocument(index, id) {
  const endpoint = new AWS.Endpoint(elasticsearchEndpoint);
  const request = new AWS.HttpRequest(endpoint, region);

  request.method = "GET";
  request.path += prefix(index) + `/_doc/${id}`;
  request.headers["host"] = elasticsearchEndpoint;
  request.headers["Content-Type"] = "application/json";
  return await awsFetch(request);
}

module.exports = { getCollection, getFileSet, getWork }