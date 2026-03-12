import * as z from "zod/v4";
import { searchResultSchema, summarizeResults } from "./common.js";
import { semanticSearch } from "../dc-api.js";

export const name = "semantic-search";

export const config = {
  title: "Semantic Search",
  description:
    "Search for items in the Digital Collections using natural language queries.",
  inputSchema: z.object({
    query: z.string().describe("The natural language query to search for."),
    max_results: z
      .number()
      .gte(1)
      .lte(20)
      .optional()
      .default(10)
      .describe("The maximum number of search results to return per page"),
    page: z
      .number()
      .gte(1)
      .optional()
      .default(1)
      .describe("The page of search results to return")
  }),
  outputSchema: searchResultSchema
};
export const handler = async ({
  query,
  max_results,
  page
}: {
  query: string;
  max_results?: number;
  page?: number;
}) => {
  const response: any = await semanticSearch(query, {
    page: page,
    size: max_results
  });
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
};

export default { name, config, handler };
