import * as z from "zod/v4";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types";
import { DC_API_BASE } from "../config.js";
import { sharedResultSchema } from "./schemas.js";
import * as lz from "lz-string";
const { compressToEncodedURIComponent } = lz.default;

const pluralize = (count: number, singular: string) => {
  return `${count} ${singular}${count !== 1 ? "s" : ""}`;
};

export const summarizeResults = (
  results: z.infer<typeof sharedResultSchema>
) => {
  const { total_hits, total_pages, current_page, limit } = results.pagination;
  return `The search returned ${pluralize(total_hits, "result")} across ${pluralize(total_pages, "page")}. The current page is ${current_page} with a limit of ${pluralize(limit, "result")} per page.`;
};

// Encoding logic cribbed from api/src/api/pagination.js
const encodeSearchToken = (queryObject: any) => {
  const encodeFields = ["query", "size", "sort", "fields", "_source"];
  let token: any = {
    body: { size: 10 },
    models: ["works"],
    format: null,
    options: {}
  };
  for (const field in queryObject) {
    if (encodeFields.includes(field)) {
      token.body[field] = queryObject[field];
    }
  }
  return compressToEncodedURIComponent(JSON.stringify(token));
};

export const buildIIIFSearchUrl = (
  queryObject: any,
  options: { page: number; size: number; visibility?: string }
) => {
  const searchToken = encodeSearchToken(queryObject);
  const iiifUrl = new URL("search/works", DC_API_BASE);
  iiifUrl.searchParams.set("searchToken", searchToken);
  iiifUrl.searchParams.set("page", options.page.toString());
  iiifUrl.searchParams.set("size", options.size.toString());
  iiifUrl.searchParams.set("visibility", options.visibility || "public");
  iiifUrl.searchParams.set("as", "iiif");
  return iiifUrl.toString();
};

export const handleToolError = (error: unknown) => {
  console.error(error);
  if (error instanceof z.ZodError) {
    throw new McpError(ErrorCode.InvalidParams, z.prettifyError(error));
  }
  throw new McpError(ErrorCode.InternalError, (error as Error).toString());
};
