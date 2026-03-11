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
  "contributor.variants",
  "creator.variants",
  "genre.variants",
  "language.variants",
  "location.variants",
  "style_period.variants",
  "subject.variants",
  "technique.variants"
];

type SearchOptions = {
  models?: sc["parameters"]["models"];
} & so["postSearchWithModels"]["parameters"]["query"];

export const getWork = async (id: string) => {
  const response = await client.GET("/works/{id}", {
    params: { path: { id } }
  });
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
      _source: { excludes: ExcludeFields }
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
