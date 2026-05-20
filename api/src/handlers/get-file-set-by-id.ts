import { getFileSet } from "../api/opensearch.ts";
import { transform as canvasResponse } from "../api/response/iiif/canvas.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const id = c.req.param("id")!;
  const userToken = c.get("userToken");
  const allowPrivate = userToken.isSuperUser() || userToken.isReadingRoom();
  const allowUnpublished = userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  const params = new URL(req.url).searchParams;
  if (params.get("as") === "iiif") {
    return await canvasResponse(esResponse, { allowPrivate, allowUnpublished });
  }
  return await opensearchResponse(esResponse);
};
