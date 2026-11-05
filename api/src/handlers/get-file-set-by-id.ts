import { getFileSet } from "../api/opensearch.ts";
import { transform as canvasResponse } from "../api/response/iiif/canvas.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import { negotiate } from "../api/response/negotiate.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const userToken = c.get("userToken");
  const allowPrivate = userToken.isSuperUser() || userToken.isReadingRoom();
  const allowUnpublished = userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  return negotiate(c, {
    iiif: () => canvasResponse(esResponse, { allowPrivate, allowUnpublished }),
    opensearch: () => opensearchResponse(esResponse),
  });
};
