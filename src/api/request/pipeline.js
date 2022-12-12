const sortJson = require("sort-json");
const ApiToken = require("../api-token");

function filterFor(query, event) {
  const matchTheQuery = query;
  const beUnpublished = { term: { published: false } };
  const beRestricted = { term: { visibility: "Private" } };

  const filter = event.userToken.isReadingRoom()
    ? { must: [matchTheQuery], must_not: [beUnpublished] }
    : { must: [matchTheQuery], must_not: [beUnpublished, beRestricted] };

  return { bool: filter };
}

module.exports = class RequestPipeline {
  constructor(searchContext) {
    this.searchContext = { ...searchContext };
    if (!this.searchContext.size) this.searchContext.size = 10;
    if (!this.searchContext.from) this.searchContext.from = 0;
  }

  // Things tranformer needs to do:
  // - not allow unpuplished or restricted items
  // - Reading room/IP (not in first iteration)
  // - Add `track_total_hits` to search context (so we can get accurate hits.total.value)

  authFilter(event) {
    this.searchContext.query = filterFor(this.searchContext.query, event);
    this.searchContext.track_total_hits = true;

    return this;
  }

  toJson() {
    return JSON.stringify(sortJson(this.searchContext));
  }
};
