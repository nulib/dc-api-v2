import * as z from "zod/v4";

export const searchResultSchema = z
  .object({
    data: z
      .array(z.any())
      .describe("The search results returned from the Digital Collections API"),
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
      .strip()
  })
  .strip();

const pluralize = (count: number, singular: string) => {
  return `${count} ${singular}${count !== 1 ? "s" : ""}`;
};

export const summarizeResults = (
  results: z.infer<typeof searchResultSchema>
) => {
  const { total_hits, total_pages, current_page, limit } = results.pagination;
  return `The search returned ${pluralize(total_hits, "result")} across ${pluralize(total_pages, "page")}. The current page is ${current_page} with a limit of ${pluralize(limit, "result")} per page.`;
};
