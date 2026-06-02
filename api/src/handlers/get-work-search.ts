import { getWork } from "../api/opensearch.ts";
import { transform as iiifSearchResponse } from "../api/response/iiif/search.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";
import type { WorkSource } from "../api/response/iiif/types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const id = c.req.param("id")!;
  const params = new URL(req.url).searchParams;
  const as = params.get("as");
  const q = params.get("q");
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
        headers: { "content-type": "application/json" },
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
