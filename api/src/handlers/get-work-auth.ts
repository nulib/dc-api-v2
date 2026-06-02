import { getWork } from "../api/opensearch.ts";
import { authorizeDocument } from "./authorize-document.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const osResponse = await getWork(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });
  return authorizeDocument(c, osResponse);
};
