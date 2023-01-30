const { wrap } = require("./middleware");
const { getCollection } = require("../api/opensearch");
const { doSearch } = require("./search-runner");
const opensearchResponse = require("../api/response/opensearch");

const getCollectionById = async (event) => {
  const id = event.pathParameters.id;
  const esResponse = await getCollection(id);
  return await opensearchResponse.transform(esResponse);
};

const getIiifCollectionById = async (event) => {
  const id = event.pathParameters.id;
  const esResponse = await getCollection(id);
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
        location: "/collections",
      },
    };
  }

  return event.queryStringParameters?.as === "iiif"
    ? getIiifCollectionById(event)
    : getCollectionById(event);
});
