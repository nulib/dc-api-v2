export interface OpenSearchHit<T = unknown> {
  _id: string;
  _source: T;
  found?: boolean;
  inner_hits?: Record<string, { hits: { hits: OpenSearchHit<unknown>[] } }>;
}

export interface OpenSearchSearchResponse<T = unknown> {
  hits: {
    hits: OpenSearchHit<T>[];
    total: { value: number };
    collapsed?: { value: number };
  };
  aggregations?: Record<string, unknown>;
  _scroll_id?: string;
}

export interface OpenSearchGetResponse<T = unknown> {
  _id?: string;
  _source?: T;
  found?: boolean;
}
