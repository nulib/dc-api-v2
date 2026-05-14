import { doSearch } from "./search-runner.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

const getCollections = async (c: Context): Promise<Response> => {
  return doSearch(c, {
    includeToken: false,
    modelOverride: "collections",
    bodyOverride: { query: { match_all: {} } },
  });
};

const getCollectionsAsIiif = async (c: Context): Promise<Response> => {
  return doSearch(c, {
    includeToken: false,
    modelOverride: "collections",
    bodyOverride: { query: { match_all: {} } },
    queryOverrides: {
      collectionLabel: "Northwestern University Libraries Digital Collections",
      collectionSummary:
        "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials.",
    },
    parameterOverrides: { as: "iiif" },
  });
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  return new URL(req.url).searchParams.get("as") === "iiif"
    ? getCollectionsAsIiif(c)
    : getCollections(c);
};
