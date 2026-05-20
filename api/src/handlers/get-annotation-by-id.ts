import { search, getFileSet } from "../api/opensearch.ts";
import { prefix, appInfo } from "../environment.ts";
import { transformError } from "../api/response/error.ts";
import { transform as iiifAnnotationsResponse } from "../api/response/iiif/annotations.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const annotationId = c.req.param("id");

  const searchBody = {
    size: 1,
    _source: ["id"],
    query: {
      bool: {
        should: [
          { term: { "annotations.id.keyword": annotationId } },
          { term: { "annotations.id": annotationId } },
        ],
        minimum_should_match: 1,
      },
    },
  };

  const searchResponse = await search(
    prefix("dc-v2-file-set"),
    JSON.stringify(searchBody),
  );

  if (searchResponse.status !== 200) {
    return transformError(searchResponse);
  }

  const searchPayload = JSON.parse(searchResponse.body);
  const hit = searchPayload?.hits?.hits?.[0];
  if (!hit) return transformError({ status: 404 });

  const fileSetId = hit?._source?.id || hit?._id;
  if (!fileSetId) return transformError({ status: 404 });

  const userToken = c.get("userToken");
  const allowPrivate = userToken.isSuperUser() || userToken.isReadingRoom();
  const allowUnpublished = userToken.isSuperUser();
  const fileSetResponse = await getFileSet(fileSetId, {
    allowPrivate,
    allowUnpublished,
  });

  if (fileSetResponse.status !== 200) {
    return transformError(fileSetResponse);
  }

  const fileSetPayload = JSON.parse(fileSetResponse.body);
  const annotation = fileSetPayload?._source?.annotations?.find(
    (item: { id: string }) => item.id === annotationId,
  );

  if (!annotation) return transformError({ status: 404 });

  const as = c.req.query("as");
  if (as === "iiif") {
    return iiifAnnotationsResponse(annotation, fileSetPayload._source);
  }

  return new Response(
    JSON.stringify({
      data: {
        ...annotation,
        file_set_id: fileSetPayload._source.id,
        work_id: fileSetPayload._source.work_id,
      },
      info: appInfo(),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
