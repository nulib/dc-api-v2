import * as z from "zod/v4";
import {
  searchLimiters,
  workSearchSchema,
  workSearchableFields,
  isEnum
} from "./schemas.js";

const FieldOverrides = {
  collection: "collection.title",
  contributor: "contributor.label",
  creator: "creator.label",
  genre: "genre.label",
  language: "language.label",
  location: "location.label",
  notes: "note.note",
  style_period: "style_period.label",
  subject: "subject.label",
  technique: "technique.label"
};

const options = ({
  page,
  max_results,
  public_only
}: {
  page: number;
  max_results: number;
  public_only: boolean;
}) => {
  return {
    page,
    size: max_results,
    visibility: public_only ? "public" : "institution,public"
  };
};

export const buildQuery = ({
  max_results,
  page,
  public_only,
  query,
  fields
}: z.infer<typeof workSearchSchema>) => {
  let shoulds = [];

  for (const [field, value] of Object.entries(fields || {})) {
    if (value) {
      const property =
        FieldOverrides[field as keyof typeof FieldOverrides] || field;
      const should = isEnum(
        workSearchableFields.shape[
          field as keyof typeof workSearchableFields.shape
        ]
      )
        ? { term: { [property]: { value } } }
        : { match: { [property]: value } };
      shoulds.push(should);
    }
  }

  const fieldSearch: any = {
    bool: {}
  };

  if (shoulds.length > 0) {
    fieldSearch.bool.should = shoulds;
    fieldSearch.bool.minimum_should_match = 1;
  }

  const neuralSearch = {
    neural: {
      embedding: {
        query_text: query,
        k: 100
      }
    }
  };

  let main;

  if (query && shoulds.length > 0) {
    // hybrid search only if there's a query and at least one field
    main = {
      hybrid: {
        queries: [fieldSearch, neuralSearch]
      }
    };
  } else if (query) {
    // neural search only if there's a query and no fields
    main = neuralSearch;
  } else if (shoulds.length === 1) {
    // if there's exactly one field, use it as the main query
    main = shoulds[0];
  } else if (shoulds.length > 1) {
    // if there are multiple fields but no query, the bool is the main query
    main = fieldSearch;
  } else {
    // if there's no query and no fields, match all
    main = { match_all: {} };
  }

  const result = {
    query: main,
    aggs: {
      collection: {
        terms: {
          field: "collection.title.keyword",
          size: 20
        }
      },
      work_type: {
        terms: {
          field: "work_type",
          size: 3
        }
      },
      visibility: {
        terms: {
          field: "visibility",
          size: 3
        }
      }
    }
  };

  return {
    query: result,
    options: options({ page, max_results, public_only })
  };
};

export const similarityworkSearchSchema = z.object({
  work_id: z.string().describe("ID of a work to find similar items for."),
  ...searchLimiters.shape
});

export const buildSimilaritySearchQuery = (
  input: z.infer<typeof similarityworkSearchSchema>
) => {
  const query = {
    query: {
      more_like_this: {
        fields: [
          "title",
          "description",
          "subject.label",
          "genre.label",
          "contributor.label",
          "creator.label"
        ],
        like: [
          {
            _id: input.work_id
          }
        ],
        max_query_terms: 10,
        min_doc_freq: 1,
        min_term_freq: 1
      }
    }
  };

  return {
    query,
    options: options(input)
  };
};
