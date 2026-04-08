import * as z from "zod/v4";
import { search } from "../dc-api.js";
import { handleToolError, trimMultilineString } from "../common/functions.js";
import {
  controlledFieldAggregations,
  controlledFieldList
} from "../common/works.js";

export const name = "find-terms";

const description = `Find controlled vocabulary terms associated with a concept. Pass a word or 
  phrase and get back the controlled terms most commonly found across works where any controlled 
  field (${controlledFieldList("or")}) contains that word — useful for discovering authorized 
  forms before searching. For example, passing 'lakota' may return the subject heading 'Teton 
  Indians'. Note that because the search matches across all controlled fields simultaneously, 
  results may include terms from unrelated fields that happen to co-occur in the same works; 
  use your judgment to select the most relevant terms for your search.`;

export const config = {
  title: "Find Terms",
  description: trimMultilineString(description),
  inputSchema: z.object({
    text: z.string().describe("The word or phrase to find matching terms for"),
    count: z
      .number()
      .default(20)
      .describe("The number of matching terms to return for each field")
  }),
  outputSchema: z.object({
    result: z
      .array(
        z.object({
          field: z
            .string()
            .describe(
              "The field the terms belong to, e.g. 'contributor', 'creator', 'genre', etc."
            ),
          terms: z.array(
            z.object({
              term: z.string().describe("The controlled term"),
              count: z
                .number()
                .describe("The number of documents referencing the term")
            })
          )
        })
      )
      .describe("The list of fields with matching terms and their counts")
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

const buildQuery = (input: z.infer<typeof config.inputSchema>) => {
  const buckets = controlledFieldAggregations(input.count);

  return {
    query: {
      bool: {
        should: [
          {
            match_phrase: {
              all_controlled_labels: input.text
            }
          },
          {
            match_phrase: {
              all_controlled_variants: input.text
            }
          }
        ],
        minimum_should_match: 1
      }
    },
    aggs: Object.assign({}, ...buckets)
  };
};

export const handler = async (input: z.infer<typeof config.inputSchema>) => {
  try {
    const query = buildQuery(input);
    const response: any = await search(query, { size: 0 });
    const result = [];

    for (const field in response.aggregations) {
      const terms = response.aggregations[field].map((bucket: any) => ({
        term: bucket.key,
        count: bucket.doc_count
      }));
      if (terms.length > 0) result.push({ field, terms });
    }

    const structuredContent = config.outputSchema.parse({ result });
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
