import createClient from "openapi-fetch";
import { DC_API_BASE } from "./config.js";
import type {
  components as sc,
  operations as so,
  paths as sp
} from "./api-schema.js";

const client = createClient<sp>({ baseUrl: DC_API_BASE });

const ExcludeFields = [
  "batch_ids",
  "behavior",
  "box_name",
  "box_number",
  "catalog_key",
  "csv_metadata_update_jobs",
  "embedding",
  "embedding_model",
  "embedding_text_length",
  "folder_name",
  "folder_number",
  "ingest_project",
  "ingest_sheet",
  "legacy_identifier",
  "preservation_level",
  "project",
  "status",
  "terms_of_use",
  "contributor.facet",
  "creator.facet",
  "genre.facet",
  "language.facet",
  "location.facet",
  "style_period.facet",
  "subject.facet",
  "technique.facet",
  "contributor.label_with_role",
  "creator.label_with_role",
  "genre.label_with_role",
  "language.label_with_role",
  "location.label_with_role",
  "style_period.label_with_role",
  "subject.label_with_role",
  "technique.label_with_role",
  "contributor.variants",
  "creator.variants",
  "genre.variants",
  "language.variants",
  "location.variants",
  "style_period.variants",
  "subject.variants",
  "technique.variants"
];

const IncludeFields = [
  "id",
  "title",
  "thumbnail",
  "collection.id",
  "collection.title",
  "description",
  "iiif_collection",
  "iiif_manifest",
  "visibility"
];

type SearchOptions = {
  models?: sc["parameters"]["models"];
} & so["postSearchWithModels"]["parameters"]["query"];

const removeFields = (obj: any, fields: string[]) => {
  for (const field of fields) {
    const fieldPath = field.split(".");
    removeAtPath(obj, fieldPath);
  }
};

const removeAtPath = (current: any, path: string[]) => {
  if (!current || typeof current !== "object") return;

  if (path.length === 1) {
    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === "object") {
          delete item[path[0]];
        }
      }
    } else {
      delete current[path[0]];
    }
    return;
  }

  const [head, ...rest] = path;
  const next = current[head];
  if (Array.isArray(next)) {
    for (const item of next) {
      removeAtPath(item, rest);
    }
  } else {
    removeAtPath(next, rest);
  }
};

export const getCollection = async (id: string) => {
  const response = await client.GET("/collections/{id}", {
    params: { path: { id } }
  });
  return response.data;
};

export const getWork = async (id: string) => {
  const response = await client.GET("/works/{id}", {
    params: { path: { id } }
  });
  removeFields(response.data?.data, ExcludeFields);
  return response.data;
};

const normalizeAggregations = (response: any) => {
  if (response?.aggregations) {
    for (const key in response.aggregations) {
      if (response.aggregations[key].buckets) {
        response.aggregations[key] = response.aggregations[key].buckets;
      }
    }
  }
};

export const visibilities = (public_only?: boolean) => {
  return public_only ? "public" : "institution,public";
};

export const search = async (query: object, options: SearchOptions = {}) => {
  const { models, ...restOptions } = options;
  const body = {
    ...query,
    _source: { includes: IncludeFields, excludes: ExcludeFields }
  };
  const params = {
    path: { models: models || ["works"] },
    query: restOptions
  };

  const response = await client.POST("/search/{models}", {
    body,
    params
  });
  normalizeAggregations(response.data);
  return response.data;
};
