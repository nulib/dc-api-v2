import { doSearch } from "./search-runner.ts";
import { modelsToTargets } from "../api/request/models.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const id = c.req.param("id");
  const models = ["works"];
  const workIndex = modelsToTargets(models);

  return doSearch(c, {
    includeToken: false,
    modelOverride: "works",
    bodyOverride: {
      query: {
        more_like_this: {
          fields: [
            "title",
            "description",
            "subject.label",
            "genre.label",
            "contributor.label",
            "creator.label",
          ],
          like: [{ _index: workIndex, _id: id }],
          max_query_terms: 10,
          min_doc_freq: 1,
          min_term_freq: 1,
        },
      },
    },
  });
};
