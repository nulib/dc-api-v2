module.exports = class RequestPipeline {
  constructor(body) {
    this.body = JSON.parse(body);
  }

  // Things tranformer needs to do:
  // - not allow unpuplished or restricted items
  // - Reading room/IP (not in first iteration)
  // - Add `track_total_hits` to body of search (so we can get accurate hits.total.value)

  authFilter() {
    const matchTheQuery = this.body.query || { match_all: {} };
    const beUnpublished = { term: { published: false } };
    const beRestricted = { term: { visibility: "Private" } };

    this.body.query = {
      bool: {
        must: [matchTheQuery],
        must_not: [beUnpublished, beRestricted],
      },
    };
    return this;
  }

  toJson() {
    return JSON.stringify(this.body);
  }
};
