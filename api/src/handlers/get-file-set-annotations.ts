import { getFileSet } from "../api/opensearch.ts";
import { appInfo } from "../environment.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import { transform as annotationsResponse } from "../api/response/iiif/file-set-annotations.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const id = c.req.param("id")!;
  const userToken = c.get("userToken");
  const allowPrivate = userToken.isSuperUser() || userToken.isReadingRoom();
  const allowUnpublished = userToken.isSuperUser();

  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  if (esResponse.status !== 200) {
    return await opensearchResponse(esResponse);
  }

  const body = JSON.parse(esResponse.body);
  const annotations = body?._source?.annotations ?? null;
  const as = new URL(req.url).searchParams.get("as");

  if (as === "iiif") {
    return await annotationsResponse(esResponse);
  }

  return new Response(JSON.stringify({ data: annotations, info: appInfo() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
