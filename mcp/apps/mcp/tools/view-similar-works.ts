import * as z from "zod/v4";
import { buildIIIFSearchUrl, handleToolError } from "../common/functions.js";
import { buildSimilaritySearchQuery } from "../common/works.js";
import { similaritySearchSchema } from "../common/schemas.js";

export const name = "view-similar-works";
export const config = {
  title: "View Similar Works",
  description:
    "View results from the similarity-search tool in an interactive viewer.",
  inputSchema: similaritySearchSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async (input: z.infer<typeof config.inputSchema>) => {
  try {
    const { query, options } = buildSimilaritySearchQuery(
      similaritySearchSchema.parse(input)
    );
    const iiifUrl = buildIIIFSearchUrl(query, options);

    return {
      content: [
        {
          type: "text" as const,
          text: `Works similar to ${input.work_id}`
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
