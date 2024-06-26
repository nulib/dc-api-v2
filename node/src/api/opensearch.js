const { HttpRequest } = require("@smithy/protocol-http");
const { awsFetch } = require("../aws/fetch");
const { openSearchEndpoint, prefix } = require("../environment");
const Honeybadger = require("../honeybadger-setup");

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
  Honeybadger.addBreadcrumb("Retrieving document", { metadata: { index, id } });
  const request = initRequest(`/${prefix(index)}/_doc/${id}`);
  let response = await awsFetch(request);
  if (response.statusCode === 200) {
    const body = JSON.parse(response.body);

    if (index !== "shared_links") {
      if (!body?.found) {
        response = {
          statusCode: 404,
          body: JSON.stringify({
            _index: prefix(index),
            _type: "_doc",
            _id: id,
            found: false,
          }),
        };
      } else if (!isVisible(body, opts)) {
        response = body?._source.published
          ? { statusCode: 403 }
          : {
              statusCode: 404,
              body: JSON.stringify({
                _index: prefix(index),
                _type: "_doc",
                _id: id,
                found: false,
              }),
            };
      }
    }
  }

  return response;
}

function isVisible(doc, { allowPrivate, allowUnpublished }) {
  const isAllowedVisibility =
    allowPrivate || doc?._source.visibility !== "Private";
  const isAllowedPublished = allowUnpublished || doc?._source.published;

  return isAllowedVisibility && isAllowedPublished;
}

function initRequest(path) {
  const endpoint = openSearchEndpoint();

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

async function search(targets, body, optionsQuery = {}) {
  Honeybadger.addBreadcrumb("Searching", { metadata: { targets, body } });
  const endpoint = openSearchEndpoint();

  const request = new HttpRequest({
    method: "POST",
    hostname: endpoint,
    headers: {
      Host: endpoint,
      "Content-Type": "application/json",
    },
    body: body,
    path: `/${targets}/_search`,
    query: optionsQuery,
  });

  return await awsFetch(request);
}

async function scroll(scrollId) {
  const endpoint = openSearchEndpoint();

  const request = new HttpRequest({
    method: "POST",
    hostname: endpoint,
    headers: {
      Host: endpoint,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scroll: "2m" }),
    path: `_search/scroll/${scrollId}`,
  });
  return await awsFetch(request);
}

async function deleteScroll(scrollId) {
  const endpoint = openSearchEndpoint();

  const request = new HttpRequest({
    method: "DELETE",
    hostname: endpoint,
    headers: {
      Host: endpoint,
      "Content-Type": "application/json",
    },
    path: `_search/scroll/${scrollId}`,
  });
  return await awsFetch(request);
}

module.exports = {
  getCollection,
  getFileSet,
  getSharedLink,
  getWork,
  search,
  scroll,
  deleteScroll,
};
