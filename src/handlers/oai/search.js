const { search } = require("../../api/opensearch");
const {
  extractRequestedModels,
  modelsToTargets,
} = require("../../api/request/models");

async function earliestRecord() {
  const body = {
    size: 1,
    _source: "indexed_at",
    query: {
      bool: {
        must: [
          { term: { api_model: "Work" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ indexed_at: "asc" }],
  };
  const esResponse = await search(
    modelsToTargets(extractRequestedModels()),
    JSON.stringify(body)
  );
  const responseBody = JSON.parse(esResponse.body);
  return responseBody?.hits?.hits[0]?._source?.indexed_at;
}

async function oaiSearch(dates) {
  let rangeQuery = { range: { indexed_at: {} } };

  if (dates.from) {
    rangeQuery.range.indexed_at.gt = dates.from;
  }

  if (dates.until) {
    rangeQuery.range.indexed_at.lt = dates.until;
  }

  const body = {
    size: 5000,
    query: {
      bool: {
        must: [
          { term: { api_model: "Work" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
          rangeQuery,
        ],
      },
    },
    sort: [{ indexed_at: "asc" }],
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

module.exports = { earliestRecord, oaiSearch };
