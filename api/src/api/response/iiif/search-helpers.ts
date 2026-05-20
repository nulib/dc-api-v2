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
  annotations: FileSetAnnotation[] = [],
  q: string,
): FileSetAnnotation[] {
  return annotations
    .filter((ann) => ann.type === "transcription")
    .filter((ann) =>
      getTranscriptionContent(ann).toLowerCase().includes(q.toLowerCase()),
    );
}
