import * as z from "zod/v4";
import { search } from "../dc-api.js";
import { searchResultSchema, summarizeResults } from "./common.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const LibraryUnits = [
  "Special Collections",
  "Faculty Collections",
  "Government and Geographic Information Collection",
  "Herskovits Library",
  "Music Library",
  "Transportation Library",
  "University Archives",
  "University Main Library"
];
const Licenses = [
  "All rights reserved",
  "Attribution 3.0 United States",
  "Attribution 4.0 International",
  "Attribution-NoDerivatives 4.0 International",
  "Attribution-NoDerivs 3.0 United States",
  "Attribution-NonCommercial 3.0 United States",
  "Attribution-NonCommercial 4.0 International",
  "Attribution-NonCommercial-NoDerivatives 4.0 International",
  "Attribution-NonCommercial-NoDerivs 3.0 United States",
  "Attribution-NonCommercial-ShareAlike 3.0 United States",
  "Attribution-NonCommercial-ShareAlike 4.0 International",
  "Attribution-ShareAlike 3.0 United States",
  "Attribution-ShareAlike 4.0 International",
  "CC0 1.0 Universal",
  "Public Domain Mark 1.0"
];
const RightsStatements = [
  "Copyright Not Evaluated",
  "Copyright Undetermined",
  "In Copyright",
  "In Copyright - Educational Use Permitted",
  "In Copyright - EU Orphan Work",
  "In Copyright - Non-Commercial Use Permitted",
  "In Copyright - Rights-holder(s) Unlocatable or Unidentifiable",
  "No Copyright - Contractual Restrictions",
  "No Copyright - Non-Commercial Use Only ",
  "No Copyright - Other Known Legal Restrictions",
  "No Copyright - United States",
  "No Known Copyright"
];
const Visibilities = ["Public", "Private", "Institution"];
const WorkTypes = ["Audio", "Image", "Video"];

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

const zString = (description: string) =>
  z.string().optional().describe(description);
const zEnum = <T extends string>(values: T[], description: string) =>
  z.enum(values).optional().describe(description);

const inputSchema = z.object({
  abstract: zString("A summary of the work"),
  alternate_title: zString("Alternate titles for the work"),
  caption: zString("The caption for a work"),
  collection: zString("The parent collection of the work"),
  contributor: zString(
    "An entity responsible for making contributions to the work"
  ),
  creator: zString("An entity primarily responsible for making the work"),
  description: zString("An account of the work"),
  genre: zString("Describes what the original object is, not what it is about"),
  keywords: zString("Keywords or tags used to describe this content"),
  language: zString("A language of the work"),
  library_unit: zEnum(
    LibraryUnits,
    "The library unit responsible for the work"
  ),
  license: zEnum(Licenses, "The Creative Commons license for the work"),
  location: zString("Place of publication"),
  notes: zString("Notes associated with the work"),
  publisher: zString("An entity responsible for making the work available"),
  rights_statement: zEnum(RightsStatements, "The rights statement of the work"),
  style_period: zString(
    "A defined style, historical period, group, school, dynasty, movement, etc. whose characteristics are represented in the work."
  ),
  subject: zString("The subject of the work"),
  table_of_contents: zString(
    "Used to provide the titles of separate works or parts of a resource. Information provided may also contain statements of responsibility or other sequential designations."
  ),
  technique: zString("The technique used in the creation of the work"),
  title: zString("The title of the work"),
  visibility: zEnum(Visibilities, "The visibility of the work"),
  work_type: zEnum(WorkTypes, "The type of the work"),

  max_results: z
    .number()
    .gte(1)
    .lte(20)
    .optional()
    .default(10)
    .describe("The maximum number of search results to return"),
  page: z
    .number()
    .gte(1)
    .optional()
    .default(1)
    .describe("The page of search results to return")
});

const isEnum = (field: any) => {
  if (field.def.innerType) return isEnum(field.def.innerType);
  return field.def.type === "enum";
};

const buildQuery = (input: any) => {
  let shoulds = [];
  let size = input.max_results;
  delete input.max_results;
  let page = input.page;
  delete input.page;

  for (const [field, value] of Object.entries(input)) {
    if (value) {
      const property =
        FieldOverrides[field as keyof typeof FieldOverrides] || field;
      const should = isEnum(
        inputSchema.shape[field as keyof typeof inputSchema.shape]
      )
        ? { term: { [property]: { value } } }
        : { match: { [property]: value } };
      shoulds.push(should);
    }
  }
  return {
    query: {
      query: {
        bool: {
          should: shoulds,
          minimum_should_match: 1
        }
      }
    },
    options: { size, page }
  };
};

export const name = "search";

export const config = {
  title: "Search",
  description:
    "Search for items in the Digital Collections using natural language queries.",
  inputSchema,
  outputSchema: searchResultSchema
};

export const handler = async (input: any) => {
  try {
    const { query, options } = buildQuery(inputSchema.parse(input));
    const response: any = await search(query, options);
    const structuredContent = searchResultSchema.parse(response);
    return {
      content: [
        {
          type: "text" as const,
          text: summarizeResults(structuredContent)
        }
      ],
      structuredContent
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, z.prettifyError(error));
    }
    throw new McpError(ErrorCode.InternalError, (error as Error).toString());
  }
};

export default { name, config, handler };
