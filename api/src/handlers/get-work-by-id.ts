import { getWork } from "../api/opensearch.ts";
import { signingConfigured } from "../api/c2pa.ts";
import { transform as manifestResponse } from "../api/response/iiif/manifest.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import {
  manifestLink,
  transform as c2paResponse,
} from "../api/response/provenance/c2pa.ts";
import { transform as premisResponse } from "../api/response/provenance/premis.ts";
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

  switch (params.get("as")) {
    case "iiif":
      return await manifestResponse(esResponse, {
        allowPrivate,
        allowUnpublished,
      });
    case "c2pa":
      return await c2paResponse(esResponse);
    case "premis":
      return await premisResponse(esResponse, {
        accept: c.req.header("accept"),
      });
  }

  const response = await opensearchResponse(esResponse);
  // Tell validators where to find the record's Content Credentials (C2PA
  // 15.5.3.2).
  if (response.status === 200 && signingConfigured()) {
    response.headers.set(
      "link",
      manifestLink(JSON.parse(esResponse.body)._source),
    );
  }
  return response;
};
