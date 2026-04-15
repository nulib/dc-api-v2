import * as z from "zod/v4";
import { search } from "../dc-api.js";
import { handleToolError, trimMultilineString } from "../common/functions.js";
import { buildQuery, controlledFieldList } from "../common/works.js";
import { workResultsSchema, workSearchSchema } from "../common/schemas.js";

export const name = "search";

const description = `Search for works in the Digital Collections using field-based and/or natural language queries. 
  If both a natural language query and specific field values are provided, the natural language 
  query will take priority, using the specified field values as additional constraints. The 
  result will also include a list of aggregations that show how many results match different 
  values for certain fields. For example, you could see how many results match each collection, 
  work type, or visibility and use that information to refine your search. Perform an empty 
  search to retrieve all works and their aggregations. NOTE: Structured field values enclosed in double 
  quotes will be treated as exact, case-sensitive matches, while unquoted values will be treated as 
  full-text searches.`;

export const config = {
  title: "Search",
  description: trimMultilineString(description),
  inputSchema: workSearchSchema,
  outputSchema: workResultsSchema,
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
