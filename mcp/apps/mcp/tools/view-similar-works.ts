import * as z from "zod/v4";
import { buildIIIFSearchUrl, handleToolError } from "../common/functions.js";
import { buildSimilaritySearchQuery } from "../common/works.js";
import {
  iiifContentSchema,
  similaritySearchSchema
} from "../common/schemas.js";

export const name = "view-similar-works";
export const config = {
  title: "View Similar Works",
  description:
    "View results from the similarity-search tool in an interactive viewer.",
  inputSchema: similaritySearchSchema,
  outputSchema: iiifContentSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async (input: z.infer<typeof config.inputSchema>) => {
  try {
    const { query, options } = await buildSimilaritySearchQuery(
      similaritySearchSchema.parse(input)
    );
    const iiifUrl = buildIIIFSearchUrl(query, options);

    const structuredContent = {
      iiifContentUrl: iiifUrl.toString()
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `Works similar to ${input.work_id}`
        },
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent)
        }
      ],
      structuredContent
    };
  } catch (error) {
    return handleToolError(error);
  }
};

export default { name, config, handler };
