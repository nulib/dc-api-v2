import ApiToken from "../api/api-token.ts";
import cookie from "cookie";
import { errorMessage } from "../helpers.ts";
import type { AppEnv } from "../types.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import { apiTokenName } from "../environment.ts";
import { getCollection, getWork, getFileSet } from "../api/opensearch.ts";
import type { Context } from "hono";
import type {
  CollectionSource,
  FileSetSource,
  WorkSource,
} from "../api/response/iiif/types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";

export function buildImageResourceId(
  uri: string,
  size = "!300,300",
  region = "full",
): string {
  return `${normalizeImageServiceId(uri)}/${region}/^${size}/0/default.jpg`;
}

export function normalizeImageServiceId(uri: string): string {
  return uri.replace(/\/info\.json$/i, "").replace(/\/+$/, "");
}

function isImageFileSet(doc: OpenSearchGetResponse<FileSetSource>): boolean {
  return (
    doc.found === true &&
    doc._source?.mime_type != null &&
    doc._source.mime_type.split("/")[0] === "image" &&
    ["Access", "Auxiliary"].includes(doc._source.role)
  );
}

function validateRequest(c: Context): {
  id: string;
  aspect: string;
  size: number;
} {
  const params = new URL(c.req.url).searchParams;
  const id = c.req.param("id")!;
  const aspect = params.get("aspect") ?? "full";
  const sizeParam = params.get("size") ?? "300";
  const size = Number(sizeParam);

  if (!["full", "square"].includes(aspect))
    throw new Error(`Unknown aspect ratio: ${aspect}`);
  if (isNaN(size)) throw new Error(`${sizeParam} is not a valid size`);
  if (size > 300)
    throw new Error(`Requested size of ${size}px exceeds maximum of 300px`);

  return { id, aspect, size };
}

const getThumbnail = async (
  c: Context<AppEnv>,
  id: string,
  aspect: string,
  size: number,
): Promise<Response> => {
  const userToken = c.get("userToken");
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);
  const allowPrivate = allowUnpublished || userToken.isReadingRoom();

  let esResponse: { status: number; body: string };
  let iiif_base: string | undefined;

  if (new URL(c.req.url).pathname.match(/\/collections\//)) {
    esResponse = await getCollection(id, { allowPrivate, allowUnpublished });
    if (esResponse.status !== 200) return await opensearchResponse(esResponse);
    const colDoc = JSON.parse(
      esResponse.body,
    ) as OpenSearchGetResponse<CollectionSource>;
    iiif_base = colDoc._source?.representative_image?.url;
  } else if (new URL(c.req.url).pathname.match(/\/file-sets\//)) {
    esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
    if (esResponse.status !== 200) return await opensearchResponse(esResponse);
    const fsDoc = JSON.parse(
      esResponse.body,
    ) as OpenSearchGetResponse<FileSetSource>;
    if (!isImageFileSet(fsDoc)) {
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }
    iiif_base = fsDoc._source?.representative_image_url;
  } else {
    esResponse = await getWork(id, { allowPrivate, allowUnpublished });
    if (esResponse.status !== 200) return await opensearchResponse(esResponse);
    const workDoc = JSON.parse(
      esResponse.body,
    ) as OpenSearchGetResponse<WorkSource>;
    iiif_base = workDoc._source?.representative_file_set?.url;
  }

  if (!iiif_base) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  const thumbnail = buildImageResourceId(iiif_base, `!${size},${size}`, aspect);
  const tokenValue = await new ApiToken().superUser().sign();
  const cookieHeader = cookie.serialize(apiTokenName(), tokenValue, {
    domain: "library.northwestern.edu",
    path: "/",
    secure: true,
  });

  const resp = await fetch(thumbnail, { headers: { cookie: cookieHeader } });
  const buf = await resp.arrayBuffer();

  if (resp.status !== 200) {
    return new Response(new TextDecoder().decode(buf), {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
    });
  }

  return new Response(buf, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "image/jpeg",
    },
  });
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  try {
    const { id, aspect, size } = validateRequest(c);
    return await getThumbnail(c, id, aspect, size);
  } catch (err) {
    return new Response(errorMessage(err), {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }
};
