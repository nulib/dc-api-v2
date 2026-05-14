import { getSharedLink, getWork } from "../api/opensearch.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id")!;
  const sharedLinkResponse = await getSharedLink(id);
  const sharedLinkResponseBody = JSON.parse(sharedLinkResponse.body);
  const expirationDate = new Date(sharedLinkResponseBody?._source?.expires);
  const workId = sharedLinkResponseBody?._source?.target_id;

  if (linkExpired(expirationDate) || !workId)
    return invalidRequest("Not Found");

  const workResponse = await getWork(workId, {
    allowPrivate: true,
    allowUnpublished: true,
  });
  if (workResponse.status !== 200) return invalidRequest("Not Found");

  c.get("userToken").addEntitlement(workId);
  return await opensearchResponse(workResponse, { expires: expirationDate });
};

const invalidRequest = (message: string): Response =>
  new Response(JSON.stringify({ message }), {
    status: 404,
    headers: { "content-type": "text/plain" },
  });

const linkExpired = (expirationDate: Date) => {
  return !isValid(expirationDate) || expirationDate <= new Date();
};

const isValid = (date: Date) => {
  return date instanceof Date && !isNaN(date.getTime());
};
