import { getFileSet } from "../api/opensearch.ts";
import { authorizeDocument } from "./authorize-document.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

const OPEN_DOCUMENT_NAMESPACE = /^0{8}-0{4}-0{4}-0{4}-0{9}[0-9A-Fa-f]{3}/;

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;

  if (OPEN_DOCUMENT_NAMESPACE.test(id)) {
    return new Response(null, { status: 204 });
  }

  const osResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });
  return authorizeDocument(c, osResponse);
};
