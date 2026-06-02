import sortJson from "sort-json";
import { defaultSearchSize } from "../../environment.ts";
import type { ApiToken } from "../api-token.ts";

function filterFor(
  userToken: ApiToken,
  searchParams: URLSearchParams,
): Record<string, unknown>[] {
  const publishedValues = userToken.can("read:Unpublished")
    ? [true, false]
    : [true];
  const userVisibility = new Set(
    userToken.can("read:Private")
      ? ["Private", "Institution", "Public"]
      : ["Institution", "Public"],
  );
  const requestVisibility = searchParams
    .get("visibility")
    ?.split(",")
    ?.map((v) => v[0].toUpperCase() + v.slice(1)) ?? [
    "Private",
    "Institution",
    "Public",
  ];
  const visibilityValues = requestVisibility.filter((v) =>
    userVisibility.has(v),
  );

  return [
    { terms: { published: publishedValues } },
    { terms: { visibility: visibilityValues } },
  ];
}

function addFilter(
  query: Record<string, unknown>,
  filter: Record<string, unknown>[],
): Record<string, unknown> {
  let result: Record<string, unknown> = { ...query };
  if (result.bool) {
    (result.bool as Record<string, unknown>).filter ||= [];
    ((result.bool as Record<string, unknown>).filter as unknown[]).push(
      ...filter,
    );
  } else if (result.neural) {
    const boolFilter: Record<string, unknown> = { bool: { filter: filter } };
    const neuralField = Object.keys(
      result.neural as Record<string, unknown>,
    )[0];
    const neuralFieldObj = (
      result.neural as Record<string, Record<string, unknown>>
    )[neuralField];
    if (neuralFieldObj.filter) {
      ((boolFilter.bool as Record<string, unknown>).filter as unknown[]).push(
        neuralFieldObj.filter,
      );
    }
    neuralFieldObj.filter = boolFilter;
  } else if (result.hybrid) {
    (result.hybrid as Record<string, unknown>).queries = (
      result.hybrid as Record<string, unknown[]>
    ).queries.map((subQuery) =>
      addFilter(subQuery as Record<string, unknown>, filter),
    );
  } else {
    result = { bool: { must: [result], filter: filter } };
  }
  return result;
}

export default class RequestPipeline {
  searchContext: Record<string, unknown>;

  constructor(searchContext: Record<string, unknown>) {
    this.searchContext = { ...searchContext };
    if (this.searchContext.size === undefined)
      this.searchContext.size = defaultSearchSize();
    if (!this.searchContext.from) this.searchContext.from = 0;
  }

  authFilter(userToken: ApiToken, searchParams: URLSearchParams): this {
    this.searchContext.query = addFilter(
      this.searchContext.query as Record<string, unknown>,
      filterFor(userToken, searchParams),
    );
    this.searchContext.track_total_hits = true;
    return this;
  }

  addNeuralModelId(): this {
    const neuralModelId = process.env["OPENSEARCH_MODEL_ID"];
    if (!neuralModelId) return this;

    const recursivelyAddNeuralModelId = (query: unknown): void => {
      if (Array.isArray(query)) {
        for (const subQuery of query) {
          recursivelyAddNeuralModelId(subQuery);
        }
      }
      if (typeof query !== "object" || query === null) return;

      for (const key in query as Record<string, unknown>) {
        if (key === "neural") {
          const [field] = Object.keys(
            (query as Record<string, Record<string, Record<string, unknown>>>)
              .neural,
          );
          const neuralFieldObj = (
            query as Record<string, Record<string, Record<string, unknown>>>
          ).neural[field];
          neuralFieldObj.model_id ||= neuralModelId;
        } else {
          recursivelyAddNeuralModelId((query as Record<string, unknown>)[key]);
        }
      }
    };

    recursivelyAddNeuralModelId(this.searchContext.query);
    return this;
  }

  addCardinality(): this {
    if ((this.searchContext as { collapse?: { field: string } }).collapse) {
      (this.searchContext.aggs as Record<string, unknown> | undefined) ||= {};
      (this.searchContext.aggs as Record<string, unknown>).__pagination = {
        cardinality: {
          field: (this.searchContext as { collapse: { field: string } })
            .collapse.field,
        },
      };
    }
    return this;
  }

  toJson(): string {
    this.addNeuralModelId().addCardinality();
    return JSON.stringify(sortJson(this.searchContext));
  }
}
