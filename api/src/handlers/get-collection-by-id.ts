import { baseUrl } from "../helpers.ts";
import { doSearch } from "./search-runner.ts";
import { getCollection } from "../api/opensearch.ts";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

const getOpts = (id: string, c: Context<AppEnv>) => {
  const userToken = c.get("userToken");
  const allowPrivate =
    userToken.isSuperUser() ||
    userToken.isReadingRoom() ||
    userToken.hasEntitlement(id);
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);
  return { allowPrivate, allowUnpublished };
};

const getCollectionById = async (
  c: Context<AppEnv>,
  id: string,
): Promise<Response> => {
  const esResponse = await getCollection(id, getOpts(id, c));
  return await opensearchResponse(esResponse);
};

const getCollectionWorksById = async (
  c: Context<AppEnv>,
  id: string,
): Promise<Response> => {
  const esResponse = await getCollection(id, getOpts(id, c));
  const collection = JSON.parse(esResponse.body)?._source;
  if (!collection) return new Response("Not Found", { status: 404 });

  // Save the original URL params for pagination URL generation (exclude collection-specific search params)
  const originalParams = Object.fromEntries(
    new URL(c.req.url).searchParams.entries(),
  );

  return doSearch(c, {
    includeToken: false,
    parameterOverrides: originalParams,
    queryOverrides: {
      query: `collection.id:${id}`,
      collectionLabel: collection?.title,
      collectionSummary: collection?.description,
    },
    defaultSort: [{ accession_number: "asc" }],
  });
};

const isEmpty = (string: string | undefined | null) => {
  return string === undefined || string === null || string === "";
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id");

  if (isEmpty(id)) {
    return new Response(null, {
      status: 301,
      headers: { location: baseUrl(c) + "collections" },
    });
  }

  switch (new URL(c.req.url).searchParams.get("as")) {
    case "iiif":
      return getCollectionWorksById(c, id);
    case "kml":
      return getCollectionWorksById(c, id);
    default:
      return getCollectionById(c, id);
  }
};
