import { ContentTypes } from "../api/response/content-types.ts";
import { getFileSet } from "../api/opensearch.ts";
import { appInfo } from "../environment.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import { transform as annotationsResponse } from "../api/response/iiif/file-set-annotations.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
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
  const as = c.get("format");

  if (as === "iiif") {
    return await annotationsResponse(esResponse);
  }

  return new Response(JSON.stringify({ data: annotations, info: appInfo() }), {
    status: 200,
    headers: { "content-type": ContentTypes.JSON },
  });
};
