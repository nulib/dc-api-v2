const sortJson = require("sort-json");
const { defaultSearchSize } = require("../../environment");

function filterFor(query, event) {
  const matchTheQuery = query;
  const beUnpublished = { term: { published: false } };
  const beRestricted = { term: { visibility: "Private" } };

  let filter = { must: [matchTheQuery], must_not: [] };

  if (!event.userToken.can("read:Unpublished")) {
    filter.must_not.push(beUnpublished);
  }

  if (!event.userToken.can("read:Private")) {
    filter.must_not.push(beRestricted);
  }

  return { bool: filter };
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
    if (this.searchContext.query?.hybrid?.queries) {
      this.searchContext.query = {
        hybrid: {
          queries: this.searchContext.query.hybrid.queries.map((query) =>
            filterFor(query, event)
          ),
        },
      };
    } else {
      this.searchContext.query = filterFor(this.searchContext.query, event);
    }
    this.searchContext.track_total_hits = true;

    return this;
  }

  toJson() {
    return JSON.stringify(sortJson(this.searchContext));
  }
};
