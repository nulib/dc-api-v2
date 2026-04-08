const sortJson = require("sort-json");
const { defaultSearchSize } = require("../../environment");

function filterFor(event) {
  const publishedValues = event.userToken.can("read:Unpublished")
    ? [true, false]
    : [true];
  const userVisibility = new Set(
    event.userToken.can("read:Private")
      ? ["Private", "Institution", "Public"]
      : ["Institution", "Public"]
  );
  const requestVisibility = event?.queryStringParameters?.visibility
    ?.split(",")
    ?.map((v) => v[0].toUpperCase() + v.slice(1)) || [
    "Private",
    "Institution",
    "Public",
  ];
  const visibilityValues = requestVisibility.filter((v) =>
    userVisibility.has(v)
  );

  return [
    { terms: { published: publishedValues } },
    { terms: { visibility: visibilityValues } },
  ];
}

function addFilter(query, filter) {
  let result = { ...query };
  if (result.bool) {
    result.bool.filter ||= [];
    result.bool.filter.push(...filter);
  } else if (result.neural) {
    const boolFilter = { bool: { filter: filter } };
    const neuralField = Object.keys(result.neural)[0];
    if (result.neural[neuralField].filter) {
      boolFilter.bool.filter.push(result.neural[neuralField].filter);
    }
    result.neural[neuralField].filter = boolFilter;
  } else if (result.hybrid) {
    result.hybrid.queries = result.hybrid.queries.map((subQuery) =>
      addFilter(subQuery, filter)
    );
  } else {
    result = {
      bool: {
        must: [result],
        filter: filter,
      },
    };
  }
  return result;
}

module.exports = class RequestPipeline {
  constructor(searchContext) {
    this.searchContext = { ...searchContext };
    if (this.searchContext.size === undefined)
      this.searchContext.size = defaultSearchSize();
    if (!this.searchContext.from) this.searchContext.from = 0;
  }

  // Things tranformer needs to do:
  // - not allow unpuplished or restricted items
  // - Reading room/IP (not in first iteration)
  // - Add `track_total_hits` to search context (so we can get accurate hits.total.value)

  authFilter(event) {
    this.searchContext.query = addFilter(
      this.searchContext.query,
      filterFor(event)
    );
    this.searchContext.track_total_hits = true;
    return this;
  }

  addNeuralModelId() {
    const neuralModelId = process.env.OPENSEARCH_MODEL_ID;
    if (!neuralModelId) return this;

    const recursivelyAddNeuralModelId = (query) => {
      if (Array.isArray(query)) {
        for (const subQuery of query) {
          recursivelyAddNeuralModelId(subQuery);
        }
      }

      if (typeof query !== "object" || query === null) return this;

      for (const key in query) {
        if (key === "neural") {
          const [field] = Object.keys(query.neural);
          query.neural[field].model_id ||= neuralModelId;
        } else {
          recursivelyAddNeuralModelId(query[key]);
        }
      }
    };

    recursivelyAddNeuralModelId(this.searchContext.query);

    return this;
  }

  toJson() {
    this.addNeuralModelId();
    return JSON.stringify(sortJson(this.searchContext));
  }
};
