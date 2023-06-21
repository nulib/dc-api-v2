const { baseUrl } = require("../helpers");
const { doSearch } = require("./search-runner");
const { getCollection } = require("../api/opensearch");
const { wrap } = require("./middleware");
const opensearchResponse = require("../api/response/opensearch");

const getOpts = (event) => {
  const id = event.pathParameters.id;

  const allowPrivate =
    event.userToken.isReadingRoom() || event.userToken.hasEntitlement(id);
  const allowUnpublished = event.userToken.hasEntitlement(id);
  return { allowPrivate, allowUnpublished };
};

const getCollectionById = async (event) => {
  const esResponse = await getCollection(
    event.pathParameters.id,
    getOpts(event)
  );
  return await opensearchResponse.transform(esResponse);
};

const getIiifCollectionById = async (event) => {
  const id = event.pathParameters.id;
  const esResponse = await getCollection(id, getOpts(event));
  const collection = JSON.parse(esResponse.body)?._source;
  if (!collection) return { statusCode: 404, body: "Not Found" };
  const parameterOverrides = { ...event.queryStringParameters };

  event.queryStringParameters.query = `collection.id:${id}`;
  event.queryStringParameters.collectionLabel = collection?.title;
  event.queryStringParameters.collectionSummary = collection?.description;
  return await doSearch(event, {
    includeToken: false,
    parameterOverrides,
  });
};

const isEmpty = (string) => {
  return string === undefined || string === null || string === "";
};

/**
 * Get a colletion by id
 */
exports.handler = wrap(async (event) => {
  if (isEmpty(event.pathParameters.id)) {
    return {
      statusCode: 301,
      headers: {
        location: baseUrl(event) + "collections",
      },
    };
  }

  return event.queryStringParameters?.as === "iiif"
    ? getIiifCollectionById(event)
    : getCollectionById(event);
});
