const AWS = require("aws-sdk");
const { awsFetch } = require("../aws/fetch");
const { prefix } = require("../aws/environment");

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

  let response = await awsFetch(request);
  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);
    if (!isVisible(body)) {
      let responseBody = {
        _index: prefix(index),
        _type: "_doc",
        _id: id,
        found: false,
      };

      response = {
        statusCode: 404,
        body: JSON.stringify(responseBody),
      };
    }
  }
  return response;
}

function isVisible(doc) {
  if (doc?._source.api_model == "FileSet") {
    return doc?._source?.visibility !== "Private";
  } else {
    return doc?._source?.published && doc?._source?.visibility !== "Private";
  }
}

async function search(targets, body) {
  const endpoint = new AWS.Endpoint(elasticsearchEndpoint);
  const request = new AWS.HttpRequest(endpoint, region);

  request.method = "POST";
  request.body = body;
  request.path += `${targets}/_search`;
  request.headers["host"] = elasticsearchEndpoint;
  request.headers["Content-Type"] = "application/json";

  return await awsFetch(request);
}

module.exports = { getCollection, getFileSet, getWork, search };
