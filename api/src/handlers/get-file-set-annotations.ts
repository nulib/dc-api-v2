import { ContentTypes } from "../api/response/content-types.ts";
import { getFileSet } from "../api/opensearch.ts";
import {
  documentBody,
  transform as opensearchResponse,
} from "../api/response/opensearch/index.ts";
import { transform as annotationsResponse } from "../api/response/iiif/file-set-annotations.ts";
import { negotiate } from "../api/response/negotiate.ts";
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

  return negotiate(c, {
    iiif: () => annotationsResponse(esResponse),
    opensearch: () =>
      new Response(documentBody(annotations), {
        status: 200,
        headers: { "content-type": ContentTypes.JSON },
      }),
  });
};
