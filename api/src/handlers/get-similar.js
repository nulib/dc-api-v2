const { doSearch } = require("./search-runner");
const { wrap } = require("./middleware");
const { modelsToTargets } = require("../api/request/models");

/**
 * Get similar works via 'More Like This' query
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const models = ["works"];
  const workIndex = modelsToTargets(models);

  event.body = {
    query: {
      more_like_this: {
        fields: [
          "title",
          "description",
          "subject.label",
          "genre.label",
          "contributor.label",
          "creator.label",
        ],
        like: [
          {
            _index: workIndex,
            _id: id,
          },
        ],
        max_query_terms: 10,
        min_doc_freq: 1,
        min_term_freq: 1,
      },
    },
  };

  return doSearch(event, { includeToken: false });
});
