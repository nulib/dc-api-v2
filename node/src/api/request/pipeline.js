const sortJson = require("sort-json");

function filterFor(event) {
  const beUnpublished = { term: { published: false } };
  const beRestricted = { term: { visibility: "Private" } };

  if (event.userToken.isSuperUser()) {
    return null;
  }

  return {
    filter_query: {
      tag: "access_filter",
      description:
        "Restricts access to unpublished and restricted items based on user's access level",
      query: {
        bool: {
          must_not: event.userToken.isReadingRoom()
            ? [beUnpublished]
            : [beUnpublished, beRestricted],
        },
      },
    },
  };
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
    delete this.searchContext.search_pipeline;

    if (event.queryStringParameters?.search_pipeline) {
      return this;
    }

    const filterProcessor = filterFor(event);
    if (filterProcessor != null) {
      this.searchContext.search_pipeline = {
        request_processors: [filterProcessor],
      };
    }
    this.searchContext.track_total_hits = true;

    return this;
  }

  toJson() {
    return JSON.stringify(sortJson(this.searchContext));
  }
};
