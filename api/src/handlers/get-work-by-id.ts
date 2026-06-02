import { getWork } from "../api/opensearch.ts";
import { transform as manifestResponse } from "../api/response/iiif/manifest.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const id = c.req.param("id")!;
  const params = new URL(req.url).searchParams;
  const userToken = c.get("userToken");

  const allowPrivate =
    userToken.isSuperUser() ||
    userToken.isReadingRoom() ||
    userToken.hasEntitlement(id);
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);

  const esResponse = await getWork(id, { allowPrivate, allowUnpublished });

  if (params.get("as") === "iiif") {
    return await manifestResponse(esResponse, {
      allowPrivate,
      allowUnpublished,
    });
  }

  return await opensearchResponse(esResponse);
};
