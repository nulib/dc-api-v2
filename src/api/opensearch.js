const { HttpRequest } = require("@aws-sdk/protocol-http");
const { awsFetch } = require("../aws/fetch");
const { elasticsearchEndpoint, prefix } = require("../aws/environment");

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
  const request = initRequest(`/${prefix(index)}/_doc/${id}`);
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
  if (!doc?.found) {
    return false;
  }
  if (doc?._source.api_model == "FileSet") {
    return doc?._source?.visibility !== "Private";
  } else {
    return doc?._source?.published && doc?._source?.visibility !== "Private";
  }
}

function initRequest(path) {
  const endpoint = elasticsearchEndpoint();

  return new HttpRequest({
    method: "GET",
    hostname: endpoint,
    headers: {
      Host: endpoint,
      "Content-Type": "application/json",
    },
    path: path,
  });
}

async function search(targets, body) {
  const endpoint = elasticsearchEndpoint();

  const request = new HttpRequest({
    method: "POST",
    hostname: endpoint,
    headers: {
      Host: endpoint,
      "Content-Type": "application/json",
    },
    body: body,
    path: `/${targets}/_search`,
  });

  return await awsFetch(request);
}

module.exports = { getCollection, getFileSet, getWork, search };
