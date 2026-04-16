import * as z from "zod/v4";
import {
  LibraryUnits,
  Licenses,
  RightsStatements,
  Visibilities,
  WorkTypes
} from "./constants.js";

export const searchLimiters = z.object({
  public_only: z
    .boolean()
    .describe("Only include publicly available works in search results")
    .default(true),
  max_results: z
    .number()
    .gte(1)
    .lte(20)
    .default(10)
    .describe("The maximum number of search results to return per page"),
  page: z
    .number()
    .gte(1)
    .default(1)
    .describe("The page of search results to return")
});

export const aggregation = z.array(
  z.object({
    key: z.string().describe("The value of the aggregated field"),
    doc_count: z
      .number()
      .describe("The number of documents matching this aggregated value")
  })
);

export const sharedResultSchema = z.object({
  pagination: z
    .object({
      current_page: z.number().describe("The current page of search results"),
      limit: z
        .number()
        .describe("The maximum number of search results returned per page"),
      total_hits: z.number().describe("The total number of search results"),
      total_pages: z
        .number()
        .describe("The total number of pages of search results")
    })
    .strip(),
  info: z
    .object({
      name: z.string().describe("The name of the API endpoint"),
      description: z.string().describe("A description of the API endpoint"),
      version: z.string().describe("The version of the API endpoint")
    })
    .strip(),
  aggregations: z.any().optional(),
  explain: z
    .any()
    .describe(
      "The explain output from Elasticsearch for the search query. Only included if the MCP is running in debug mode."
    )
    .optional()
});

export const workSearchableFields = z
  .object({
    abstract: z.string().optional().describe("A summary of the work"),
    alternate_title: z
      .string()
      .optional()
      .describe("Alternate titles for the work"),
    caption: z.string().optional().describe("The caption for a work"),
    collection: z
      .string()
      .optional()
      .describe("The parent collection of the work"),
    contributor: z
      .string()
      .optional()
      .describe("An entity responsible for making contributions to the work"),
    creator: z
      .string()
      .optional()
      .describe("An entity primarily responsible for making the work"),
    description: z.string().optional().describe("An account of the work"),
    genre: z
      .string()
      .optional()
      .describe("Describes what the original object is, not what it is about"),
    keywords: z
      .string()
      .optional()
      .describe("Keywords or tags used to describe this content"),
    language: z.string().optional().describe("A language of the work"),
    library_unit: z
      .enum(LibraryUnits)
      .optional()
      .describe("The library unit responsible for the work"),
    license: z
      .enum(Licenses)
      .optional()
      .describe("The Creative Commons license for the work"),
    location: z.string().optional().describe("Place of publication"),
    notes: z.string().optional().describe("Notes associated with the work"),
    publisher: z
      .string()
      .optional()
      .describe("An entity responsible for making the work available"),
    rights_statement: z
      .enum(RightsStatements)
      .optional()
      .describe("The rights statement of the work"),
    style_period: z
      .string()
      .optional()
      .describe(
        "A defined style, historical period, group, school, dynasty, movement, etc. whose characteristics are represented in the work."
      ),
    subject: z.string().optional().describe("The subject of the work"),
    table_of_contents: z
      .string()
      .optional()
      .describe(
        "Used to provide the titles of separate works or parts of a resource. Information provided may also contain statements of responsibility or other sequential designations."
      ),
    technique: z
      .string()
      .optional()
      .describe("The technique used in the creation of the work"),
    title: z.string().optional().describe("The title of the work"),
    work_type: z.enum(WorkTypes).optional().describe("The type of the work"),
    text: z.string().optional().describe("Full text associated with the work"),
    controlled_terms: z
      .string()
      .optional()
      .describe(
        "All controlled terms associated with the work, across all fields. Useful for searching across all controlled fields simultaneously without specifying which field."
      )
  })
  .describe(
    "Structured field search. Best when searching for specific known items or values, or for narrowing a search by specifying particular fields to search within."
  );

export const workSearchSchema = z
  .object({
    query: z
      .string()
      .optional()
      .describe(
        "A natural language query. Best for exploratory / conceptual searches."
      ),
    fields: workSearchableFields.optional(),
    ...searchLimiters.shape
  })
  .describe(
    "Search for items in the Digital Collections using either a natural language query or specific field values. If both a natural language query and specific field values are provided, the search will return items that match the natural language query and have the specified field values."
  );

export const workResultSchema = z.object({
  id: z.string().describe("The unique identifier for the search result item"),
  title: z
    .union([z.string(), z.null()])
    .describe("The title of the search result item"),
  description: z
    .array(z.string())
    .describe("A brief description of the search result item"),
  thumbnail: z
    .url()
    .describe("A URL to a thumbnail image representing the search result item"),
  collection: z.object({
    title: z
      .string()
      .describe("The title of the collection the search result item belongs to")
  }),
  iiif_manifest: z
    .url()
    .describe("A URL to the IIIF manifest for the search result item"),
  visibility: z
    .enum(Visibilities)
    .describe("Whether the item is publicly accessible")
});

export const workResultsSchema = z.object({
  data: z
    .array(workResultSchema)
    .describe("The search results returned from the Digital Collections API"),
  ...sharedResultSchema.shape
});

export const similaritySearchSchema = z.object({
  work_id: z.string().describe("ID of a work to find similar items for."),
  ...searchLimiters.shape
});

export const collectionResultSchema = z.object({
  id: z.string().describe("The unique identifier for the search result item"),
  title: z.string().describe("The title of the search result item"),
  description: z
    .string()
    .describe("A brief description of the search result item"),
  thumbnail: z
    .url()
    .describe("A URL to a thumbnail image representing the search result item"),
  iiif_collection: z
    .url()
    .describe("A URL to the IIIF collection for the search result item"),
  visibility: z
    .enum(Visibilities)
    .describe("Whether the item is publicly accessible")
});

export const collectionResultsSchema = z.object({
  data: z
    .array(collectionResultSchema)
    .describe("The search results returned from the Digital Collections API"),
  ...sharedResultSchema.shape
});

export const isEnum = (field: any): boolean => {
  if (field.def.innerType) return isEnum(field.def.innerType);
  return field.def.type === "enum";
};
