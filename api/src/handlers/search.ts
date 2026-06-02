import { doSearch } from "./search-runner.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const getSearch = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const includeToken = !!new URL(req.url).searchParams.get("searchToken");
  return await doSearch(c, { includeToken });
};

export const postSearch = async (c: Context<AppEnv>): Promise<Response> => {
  return await doSearch(c);
};
