import { getFileSet } from "../api/opensearch.ts";
import { transform as canvasResponse } from "../api/response/iiif/canvas.ts";
import { transform as kmlResponse } from "../api/response/kml/index.ts";
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
  switch (params.get("as")) {
    case "iiif":
      return await canvasResponse(esResponse, {
        allowPrivate,
        allowUnpublished,
      });
    case "kml":
      const response = JSON.parse(esResponse.body);
      return await kmlResponse(response);
    default:
      return await opensearchResponse(esResponse);
  }
};
