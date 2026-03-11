import * as z from "zod/v4";
import { search } from "../dc-api.js";
import { handleToolError } from "../common/functions.js";
import { collectionResultsSchema, searchLimiters } from "../common/schemas.js";

export const name = "list-collections";

export const config = {
  title: "List Collections",
  description: "List collection records from the NUL Digital Collections.",
  inputSchema: searchLimiters,
  outputSchema: collectionResultsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async (input: z.infer<typeof config.inputSchema>) => {
  try {
    const query = {
      query: { match_all: {} },
      sort: [{ title: { order: "asc" } }]
    };
    const options = {
      models: ["collections"],
      size: input.max_results,
      page: input.page,
      visibility: input.public_only ? "public" : "institution,public"
    };
    const response: any = await search(query, options);
    const structuredContent = collectionResultsSchema.parse(response);
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
