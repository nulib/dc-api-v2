import createClient from "openapi-fetch";
import { DC_API_BASE, SEARCH_MODEL_ID } from "./config.js";
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
  "collection",
  "description",
  "iiif_manifest"
];

type SearchOptions = {
  models?: sc["parameters"]["models"];
} & so["postSearchWithModels"]["parameters"]["query"];

const removeFields = (obj: any, fields: string[]) => {
  for (const field of fields) {
    const fieldPath = field.split(".");
    removeAtPath(obj, fieldPath);
  }
  console.log(obj);
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

export const search = async (query: object, options: SearchOptions = {}) => {
  const { models, ...restOptions } = options;

  const response = await client.POST("/search/{models}", {
    body: {
      size: options.size,
      from:
        options.page && options.size
          ? (options.page - 1) * options.size
          : undefined,
      ...query,
      _source: { includes: IncludeFields, excludes: ExcludeFields }
    },
    params: {
      path: { models: models || ["works"] },
      query: restOptions
    }
  });

  return response.data;
};

export const semanticSearch = async (
  query: string,
  options: SearchOptions = {}
) => {
  const semanticQuery: object = {
    query: {
      neural: {
        embedding: {
          query_text: query,
          model_id: SEARCH_MODEL_ID,
          k: 100
        }
      }
    }
  };

  return await search(semanticQuery, options);
};

export const whoami = async () => {
  const response = await client.GET("/auth/whoami", {});
  return response.data;
};
