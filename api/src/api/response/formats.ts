/**
 * Every response format this API can produce, and everything that identifies
 * one: the `as` values that request it, the media types that negotiate it, and
 * the `Content-Type` it is served with. The route handlers, `content-types.ts`,
 * the published OpenAPI spec, and the test matchers all derive from this table,
 * so a new format is added here and nowhere else.
 *
 * Key order is preference order: where a request is satisfied by more than one
 * format, the one declared first wins.
 */

type ContentTypeParts = {
  readonly mime: string;
  readonly profile?: string;
  readonly charset?: string;
};

type FormatDefinition = {
  /**
   * Values of the `as` query parameter that select this format. Several
   * formats may share one — `as=premis` names the PREMIS family, and the
   * `Accept` header picks the member.
   */
  readonly as: readonly string[];
  /** Media types that select this format via the `Accept` header. */
  readonly accept: readonly string[];
  readonly contentType: ContentTypeParts;
};

export const Formats = {
  opensearch: {
    as: ["opensearch"],
    accept: ["application/json"],
    contentType: { mime: "application/json", charset: "UTF-8" },
  },
  iiif: {
    as: ["iiif"],
    accept: ["application/ld+json"],
    contentType: {
      mime: "application/ld+json",
      profile: '"http://iiif.io/api/presentation/3/context.json"',
      charset: "UTF-8",
    },
  },
  c2pa: {
    as: ["c2pa"],
    accept: ["application/c2pa"],
    contentType: { mime: "application/c2pa" },
  },
  premisxml: {
    as: ["premis"],
    accept: ["application/premis+xml"],
    contentType: { mime: "application/xml", charset: "UTF-8" },
  },
  premisjson: {
    as: ["premis"],
    accept: ["application/json"],
    contentType: { mime: "application/json", charset: "UTF-8" },
  },
} as const satisfies Record<string, FormatDefinition>;

export type ResponseFormat = keyof typeof Formats;

/** The representation a request that states no preference gets. */
export const DEFAULT_FORMAT: ResponseFormat = "opensearch";

export const FORMATS = Object.keys(Formats) as ResponseFormat[];

/** The `Content-Type` header value a format's responses carry. */
export function contentTypeFor(format: ResponseFormat): string {
  const { mime, profile, charset }: ContentTypeParts =
    Formats[format].contentType;
  return [
    mime,
    profile && `profile=${profile}`,
    charset && `charset=${charset}`,
  ]
    .filter(Boolean)
    .join("; ");
}

type MediaRange = {
  readonly type: string;
  readonly subtype: string;
  readonly q: number;
};

/**
 * The media ranges of an `Accept` header, most-preferred first. Ranges the
 * client rejected outright (`q=0`) are dropped, and ranges of equal quality
 * keep the order they were sent in.
 *
 * Parameters other than `q` are ignored, so a client can't ask for IIIF by
 * profile alone; it asks for `application/ld+json`. Splitting on commas also
 * assumes no parameter value contains one, which is true of every media type
 * this API serves.
 */
export function parseAccept(header: string | undefined): MediaRange[] {
  const ranges: (MediaRange & { index: number })[] = [];

  for (const [index, entry] of (header ?? "").split(",").entries()) {
    const [mediaType, ...params] = entry.split(";").map((part) => part.trim());
    if (!mediaType) continue;

    const [type, subtype = "*"] = mediaType.toLowerCase().split("/");
    const quality = params.find((param) =>
      param.toLowerCase().startsWith("q="),
    );
    const q = quality ? Number.parseFloat(quality.slice(2)) : 1;
    if (!type || Number.isNaN(q) || q <= 0) continue;

    ranges.push({ type, subtype, q, index });
  }

  return ranges
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ type, subtype, q }) => ({ type, subtype, q }));
}

/**
 * The format a request asks for, among the ones a route can produce.
 *
 * `as` is an explicit instruction: a value naming a format the route doesn't
 * produce is `undefined`, which the caller turns into a 406. The `Accept`
 * header is a preference: it's honored in quality order where it can be, and
 * disregarded where it can't, which leaves `preferred` or the default
 * representation rather than refusing the request.
 *
 * A route that can't produce the default representation at all — IIIF content
 * search, say — has nothing to fall back to, so it answers only a request that
 * asks for one of its formats by name.
 */
export function negotiateFormat(
  request: { as?: string | undefined; accept?: string | undefined },
  supported: readonly ResponseFormat[],
  preferred?: ResponseFormat,
): ResponseFormat | undefined {
  const available = FORMATS.filter((format) => supported.includes(format));
  if (available.length === 0) return undefined;

  const ranges = parseAccept(request.accept);

  if (request.as) {
    const candidates = available.filter((format) =>
      (Formats[format].as as readonly string[]).includes(request.as!),
    );
    if (candidates.length === 0) return undefined;
    // `as` may name a family; `Accept` picks the member, defaulting to the
    // first the registry declares.
    return bestMatch(ranges, candidates) ?? candidates[0];
  }

  return bestMatch(ranges, available) ?? fallback(available, preferred);
}

// The most-preferred acceptable format, or `undefined` where the header asks
// for anything (a `*` wildcard) or for nothing these formats provide.
function bestMatch(
  ranges: readonly MediaRange[],
  candidates: readonly ResponseFormat[],
): ResponseFormat | undefined {
  for (const range of ranges) {
    if (range.type === "*" && range.subtype === "*") return undefined;
    const match = candidates.find((format) =>
      Formats[format].accept.some((mediaType) => matches(range, mediaType)),
    );
    if (match) return match;
  }
  return undefined;
}

function matches(range: MediaRange, mediaType: string): boolean {
  const [type, subtype] = mediaType.toLowerCase().split("/");
  return (
    (range.type === "*" || range.type === type) &&
    (range.subtype === "*" || range.subtype === subtype)
  );
}

function fallback(
  available: readonly ResponseFormat[],
  preferred?: ResponseFormat,
): ResponseFormat | undefined {
  if (preferred && available.includes(preferred)) return preferred;
  return available.includes(DEFAULT_FORMAT) ? DEFAULT_FORMAT : undefined;
}
