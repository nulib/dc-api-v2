import * as z from "zod/v4";
import { search } from "../dc-api.js";
import {
  workResultsSchema,
  similaritySearchSchema
} from "../common/schemas.js";
import { handleToolError } from "../common/functions.js";
import { buildSimilaritySearchQuery } from "../common/works.js";

export const name = "similarity-search";

export const config = {
  title: "Search for Similar Works",
  description: "Find works similar to a given work.",
  inputSchema: similaritySearchSchema,
  outputSchema: workResultsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async (input: z.infer<typeof config.inputSchema>) => {
  try {
    const { query, options } = buildSimilaritySearchQuery(input);
    const response: any = await search(query, options);
    const structuredContent = workResultsSchema.parse(response);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent)
        }
      ],
      structuredContent
    };
  } catch (error) {
    handleToolError(error);
  }
};

export default { name, config, handler };
