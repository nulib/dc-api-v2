import { getWork } from "../api/opensearch.ts";
import { signingConfigured } from "../api/c2pa.ts";
import { transform as manifestResponse } from "../api/response/iiif/manifest.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import {
  manifestLink,
  transform as c2paResponse,
} from "../api/response/provenance/c2pa.ts";
import { transform as premisResponse } from "../api/response/provenance/premis.ts";
import { negotiate } from "../api/response/negotiate.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const userToken = c.get("userToken");

  const allowPrivate =
    userToken.isSuperUser() ||
    userToken.isReadingRoom() ||
    userToken.hasEntitlement(id);
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);

  const esResponse = await getWork(id, { allowPrivate, allowUnpublished });

  return negotiate(c, {
    iiif: () =>
      manifestResponse(esResponse, { allowPrivate, allowUnpublished }),
    opensearch: () => workDocument(esResponse),
    c2pa: () => c2paResponse(esResponse),
    premisjson: () => premisResponse(esResponse, { format: "json" }),
    premisxml: () => premisResponse(esResponse, { format: "xml" }),
  });
};

/** The default work response, advertising where its Content Credentials live. */
const workDocument = async (esResponse: {
  status: number;
  body: string;
}): Promise<Response> => {
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
