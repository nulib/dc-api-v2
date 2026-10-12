import { ContentTypes } from "../api/response/content-types.ts";
import { getFileSet } from "../api/opensearch.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import { transform as iiifSearchResponse } from "../api/response/iiif/file-set-search.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";
import type { FileSetSource } from "../api/response/iiif/types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const as = c.get("format");
  const q = c.req.query("q");
  const userToken = c.get("userToken");
  const allowPrivate = userToken.isSuperUser() || userToken.isReadingRoom();
  const allowUnpublished = userToken.isSuperUser();

  if (as !== "iiif" || !q?.trim()) {
    return new Response(
      JSON.stringify({ message: "Request must include ?as=iiif&q={query}" }),
      { status: 400, headers: { "content-type": ContentTypes.JSON } },
    );
  }

  const fileSetResponse = await getFileSet(id, {
    allowPrivate,
    allowUnpublished,
  });
  if (fileSetResponse.status !== 200) {
    return await opensearchResponse(fileSetResponse);
  }

  const fileSetSource = (
    JSON.parse(fileSetResponse.body) as OpenSearchGetResponse<FileSetSource>
  )._source!;
  return await iiifSearchResponse(fileSetSource, q);
};
