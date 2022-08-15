module.exports = class RequestPipeline {
  constructor(searchContext) {
    this.searchContext = { ...searchContext };
    this.searchContext.query ||= { match_all: {} };
  }

  // Things tranformer needs to do:
  // - not allow unpuplished or restricted items
  // - Reading room/IP (not in first iteration)
  // - Add `track_total_hits` to search context (so we can get accurate hits.total.value)

  authFilter() {
    const matchTheQuery = this.searchContext.query;
    const beUnpublished = { term: { published: false } };
    const beRestricted = { term: { visibility: "Private" } };

    this.searchContext.query = {
      bool: {
        must: [matchTheQuery],
        must_not: [beUnpublished, beRestricted],
      },
    };
    this.searchContext.track_total_hits = true;

    return this;
  }

  toJson() {
    return JSON.stringify(this.searchContext);
  }
};
