const { search } = require("../../api/opensearch");
const {
  extractRequestedModels,
  modelsToTargets,
} = require("../../api/request/models");

async function earliestRecord() {
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
    sort: [{ create_date: "asc" }],
  };
  const esResponse = await search(
    modelsToTargets(extractRequestedModels()),
    JSON.stringify(body)
  );
  const responseBody = JSON.parse(esResponse.body);
  return responseBody?.hits?.hits[0]?._source?.create_date;
}

async function oaiSearch(dates) {
  let rangeQuery = { range: { modified_date: {} } };

  if (dates.from) {
    rangeQuery.range.modified_date.gt = dates.from;
  }

  if (dates.until) {
    rangeQuery.range.modified_date.lt = dates.until;
  }

  const body = {
    size: 1000,
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
    sort: [{ modified_date: "asc" }],
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

async function oaiSets() {
  const body = {
    size: 10000,
    _source: ["id", "title"],
    query: {
      bool: {
        must: [
          { term: { api_model: "Collection" } },
          { term: { published: true } },
          { term: { visibility: "Public" } },
        ],
      },
    },
    sort: [{ title: "asc" }],
  };

  const esResponse = await search(
    modelsToTargets(["collections"]),
    JSON.stringify(body)
  );
  return esResponse;
}

module.exports = { earliestRecord, oaiSearch, oaiSets };
