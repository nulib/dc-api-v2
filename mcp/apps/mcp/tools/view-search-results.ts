import * as z from "zod/v4";
import { buildIIIFSearchUrl, handleToolError } from "../common/functions.js";
import { buildQuery } from "../common/works.js";
import { workSearchSchema } from "../common/schemas.js";

export const name = "view-search-results";
export const config = {
  title: "View Search Results",
  description:
    "View results from the search-works tool in an interactive viewer.",
  inputSchema: workSearchSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async (input: z.infer<typeof workSearchSchema>) => {
  try {
    const { query, options } = buildQuery(workSearchSchema.parse(input));
    const iiifUrl = buildIIIFSearchUrl(query, options);

    return {
      content: [
        {
          type: "text" as const,
          text: `NUL DC API Search Results`
        }
      ],
      structuredContent: {
        iiifContentUrl: iiifUrl.toString()
      }
    };
  } catch (error) {
    handleToolError(error);
  }
};

export default { name, config, handler };
