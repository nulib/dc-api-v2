import { dcApiEndpoint } from "../../../environment.ts";
import {
  getTranscriptionContent,
  normalizeLanguages,
} from "./presentation-api/items.ts";
import type { FileSetAnnotation } from "./types.ts";

export function buildSearchAnnotationBody(
  annotation: FileSetAnnotation,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: "TextualBody",
    value: getTranscriptionContent(annotation),
    format: "text/plain",
  };
  const languages = normalizeLanguages(annotation.language);
  if (languages.length === 1) {
    body.language = languages[0];
  } else if (languages.length > 1) {
    body.language = languages;
  }
  return body;
}

export function buildAnnotationTarget(
  canvasId: string,
  workId: string | undefined,
): Record<string, unknown> {
  const source: Record<string, unknown> = { id: canvasId, type: "Canvas" };
  if (workId) {
    source.partOf = [
      {
        id: `${dcApiEndpoint()}/works/${workId}?as=iiif`,
        type: "Manifest",
      },
    ];
  }
  return { type: "SpecificResource", source };
}

export function transcriptionAnnotationsMatching(
  annotations: FileSetAnnotation[] | null | undefined,
  q: string,
): FileSetAnnotation[] {
  return (annotations ?? [])
    .filter((ann) => ann.type === "transcription")
    .filter((ann) =>
      getTranscriptionContent(ann).toLowerCase().includes(q.toLowerCase()),
    );
}

export const CONTEXT_PREFIX_LENGTH = 60;
export const CONTEXT_SUFFIX_LENGTH = 100;
// Bounds the response size: each context annotation is roughly 400 bytes, so
// a one-letter query over a long transcript could otherwise produce megabytes
// and exceed the Lambda response limit.
export const MAX_CONTEXT_MATCHES = 100;

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

// Slice offsets are UTF-16 code units; move the outer edges inward so neither
// end splits a surrogate pair (e.g. an emoji) and leaves half a character.
function contextSlices(text: string, start: number, end: number) {
  let prefixStart = Math.max(0, start - CONTEXT_PREFIX_LENGTH);
  if (prefixStart > 0 && isLowSurrogate(text.charCodeAt(prefixStart))) {
    prefixStart++;
  }
  let suffixEnd = Math.min(text.length, end + CONTEXT_SUFFIX_LENGTH);
  if (
    suffixEnd < text.length &&
    isHighSurrogate(text.charCodeAt(suffixEnd - 1))
  ) {
    suffixEnd--;
  }
  return {
    prefix: text.slice(prefixStart, start),
    suffix: text.slice(end, suffixEnd),
  };
}

// Keep quotes verbatim: TextQuoteSelector context is source text, not HTML or
// display punctuation. Clients can render the bounded prefix/exact/suffix.
// Returns at most MAX_CONTEXT_MATCHES annotations, in item and text order.
export function buildSearchContext(
  items: { id: string; body: Record<string, unknown> }[],
  q: string,
  searchId: string,
) {
  if (!q.trim()) return [];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [];
  for (const item of items) {
    const text = String(item.body.value ?? "");
    for (const match of text.matchAll(new RegExp(escaped, "gi"))) {
      if (matches.length >= MAX_CONTEXT_MATCHES) break;
      const start = match.index!;
      const end = start + match[0].length;
      const { prefix, suffix } = contextSlices(text, start, end);
      matches.push({
        id: `${searchId}#context-${encodeURIComponent(item.id)}-${start}`,
        type: "Annotation",
        motivation: "contextualizing",
        target: {
          type: "SpecificResource",
          source: item.id,
          selector: [
            {
              type: "TextQuoteSelector",
              prefix,
              exact: match[0],
              suffix,
            },
          ],
        },
      });
    }
  }
  return matches.length
    ? [{ id: `${searchId}#context`, type: "AnnotationPage", items: matches }]
    : [];
}
