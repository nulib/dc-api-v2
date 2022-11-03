const { HttpRequest } = require("@aws-sdk/protocol-http");
const { awsFetch } = require("../aws/fetch");
const { elasticsearchEndpoint, prefix } = require("../aws/environment");

async function getCollection(id, opts) {
  return getDocument("dc-v2-collection", id, opts);
}

async function getFileSet(id, opts) {
  return getDocument("dc-v2-file-set", id, opts);
}

async function getWork(id, opts) {
  return getDocument("dc-v2-work", id, opts);
}

async function getSharedLink(id, opts) {
  return getDocument("shared_links", id, opts);
}

async function getDocument(index, id, opts = {}) {
  const request = initRequest(`/${prefix(index)}/_doc/${id}`);
  let response = await awsFetch(request);
  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);
    if (index != "shared_links" && !isVisible(body, opts)) {
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

function isVisible(doc, { allowPrivate, allowUnpublished }) {
  if (!doc?.found) return false;
  const isAllowedVisibility =
    allowPrivate || doc?._source.visibility !== "Private";
  const isAllowedPublished = allowUnpublished || doc?._source.published;
  return isAllowedVisibility && isAllowedPublished;
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

module.exports = { getCollection, getFileSet, getSharedLink, getWork, search };
