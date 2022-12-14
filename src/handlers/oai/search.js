const { search } = require("../../api/opensearch");
const {
  extractRequestedModels,
  modelsToTargets,
} = require("../../api/request/models");
const fs = require("fs");

async function earliestRecordCreateDate() {
  const body = {
    size: 1,
    _source: "create_date",
    query: {
      bool: {
        must: [
          { term: { api_model: "Work" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ create_date: "desc" }],
  };
  const esResponse = await search(
    modelsToTargets(extractRequestedModels()),
    JSON.stringify(body)
  );
  const responseBody = JSON.parse(esResponse.body);
  return responseBody?.hits?.hits[0]?._source?.create_date;
}

async function oaiSearch() {
  const body = {
    size: 5000,
    query: {
      bool: {
        must: [
          { term: { api_model: "Work" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ create_date: "desc" }],
  };
  const esResponse = await search(
    modelsToTargets(extractRequestedModels()),
    JSON.stringify(body),
    { scroll: "2m" }
  );
  return {
    ...esResponse,
    expiration: new Date(new Date().getTime() + 2 * 60000).toISOString(),
  };
}

module.exports = { earliestRecordCreateDate, oaiSearch };
