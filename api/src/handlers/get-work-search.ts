import { ContentTypes } from "../api/response/content-types.ts";
import { getWork } from "../api/opensearch.ts";
import { transform as iiifSearchResponse } from "../api/response/iiif/search.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";
import type { WorkSource } from "../api/response/iiif/types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const q = c.req.query("q");
  const as = c.get("format");
  const userToken = c.get("userToken");

  const allowPrivate =
    userToken.isSuperUser() ||
    userToken.isReadingRoom() ||
    userToken.hasEntitlement(id);
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);

  if (as !== "iiif" || !q?.trim()) {
    return new Response(
      JSON.stringify({
        message: "Request must include ?as=iiif&q={query}",
      }),
      {
        status: 400,
        headers: { "content-type": ContentTypes.JSON },
      },
    );
  }

  const workResponse = await getWork(id, { allowPrivate, allowUnpublished });
  if (workResponse.status !== 200)
    return new Response(workResponse.body, { status: workResponse.status });

  const workSource = (
    JSON.parse(workResponse.body) as OpenSearchGetResponse<WorkSource>
  )._source!;
  return await iiifSearchResponse(workSource, q, {
    allowPrivate,
    allowUnpublished,
  });
};
