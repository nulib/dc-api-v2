import * as z from "zod/v4";
import { getWork } from "../dc-api.js";
import {
  searchLimiters,
  workSearchSchema,
  workSearchableFields,
  isEnum
} from "./schemas.js";
import { components } from "../api-schema.js";

const ControlledFields = [
  "contributor",
  "creator",
  "genre",
  "language",
  "location",
  "style_period",
  "subject",
  "technique"
];

export const controlledFieldList = (conjunction = "and") =>
  ControlledFields.slice(0, -1).join(", ") +
  `, ${conjunction} ` +
  ControlledFields.slice(-1);

export const controlledFieldAggregations = (count: number = 10) =>
  Object.fromEntries(
    ControlledFields.map((field) => [
      field,
      {
        terms: {
          field: `${field}.label`,
          size: count,
          min_doc_count: 5
        }
      }
    ])
  );

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
  technique: "technique.label",
  text: "all_text",
  controlled_terms: "all_controlled_labels"
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

const makeCriterion = (field: string, value: string) => {
  if (!value) return null;

  let property = FieldOverrides[field as keyof typeof FieldOverrides] || field;
  if (property.endsWith(".label") && !value.match(/^".+"$/)) {
    property = property + ".text";
  }
  value = value.replace(/^"|"$/g, "");

  const criterion = isEnum(
    workSearchableFields.shape[field as keyof typeof workSearchableFields.shape]
  )
    ? { term: { [property]: { value } } }
    : { match: { [property]: value } };
  return criterion;
};

export const buildQuery = ({
  max_results,
  page,
  public_only,
  query,
  fields
}: z.infer<typeof workSearchSchema>) => {
  let criteria = [];

  for (const [field, value] of Object.entries(fields || {})) {
    if (value) {
      criteria.push(makeCriterion(field, value));
    }
  }

  const fieldSearch: any = {
    bool: {}
  };

  if (criteria.length > 0) {
    fieldSearch.bool.should = criteria;
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

  if (query && criteria.length > 0) {
    // hybrid search only if there's a query and at least one field
    main = {
      neural: {
        embedding: { ...neuralSearch.neural.embedding, filter: fieldSearch }
      }
    };
  } else if (query) {
    // neural search only if there's a query and no fields
    main = neuralSearch;
  } else if (criteria.length === 1) {
    // if there's exactly one field, use it as the main query
    main = criteria[0];
  } else if (criteria.length > 1) {
    // if there are multiple fields but no query, the bool is the main query
    main = fieldSearch;
  } else {
    // if there's no query and no fields, match all
    main = { match_all: {} };
  }

  const result = {
    query: main,
    aggs: {
      ...controlledFieldAggregations(),
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

export const buildSimilaritySearchQuery = async (
  input: z.infer<typeof similarityworkSearchSchema>
) => {
  const mlt_query = {
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
  };

  const doc = await getWork(input.work_id, true);
  const work = doc?.data as components["schemas"]["Work"];
  const embedding = work?.embedding;

  let query: any = mlt_query;
  if (embedding) {
    const knn_query = {
      knn: {
        embedding: {
          vector: embedding,
          k: input.max_results,
          filter: {
            bool: {
              must_not: {
                ids: { values: [input.work_id] }
              }
            }
          }
        }
      }
    };

    query = {
      hybrid: {
        queries: [knn_query, mlt_query]
      }
    };
  }

  return {
    query: { query },
    options: options(input)
  };
};
