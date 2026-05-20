import { normalizeLanguages } from "./presentation-api/items.ts";
import {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
} from "./search-helpers.ts";
import { dcApiEndpoint } from "../../../environment.ts";
import type { FileSetAnnotation, FileSetSource } from "./types.ts";

export const SUPPORTED_ANNOTATION_TYPES = [
  "transcription",
  "nav_place",
  "georeference",
];

export function isSupportedAnnotation(
  annotation: FileSetAnnotation = { type: "" },
): boolean {
  return (
    SUPPORTED_ANNOTATION_TYPES.includes(annotation.type) &&
    typeof annotation.content === "string" &&
    annotation.content.trim() !== ""
  );
}

export function supportedAnnotations(
  annotations: FileSetAnnotation[] = [],
): FileSetAnnotation[] {
  return annotations.filter(isSupportedAnnotation);
}

export function buildFileSetAnnotation(
  annotation: FileSetAnnotation,
  fileSet: FileSetSource,
): Record<string, unknown> {
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const annotationId = `${dcApiEndpoint()}/annotations/${annotation.id}?as=iiif`;

  switch (annotation.type) {
    case "nav_place":
      return buildNavPlaceAnnotation(
        annotation,
        fileSet,
        annotationId,
        canvasId,
      );
    case "georeference":
      return buildGeoreferenceAnnotation(
        annotation,
        fileSet,
        annotationId,
        canvasId,
      );
    case "transcription":
    default:
      return buildTranscriptionAnnotation(
        annotation,
        fileSet,
        annotationId,
        canvasId,
      );
  }
}

function buildTranscriptionAnnotation(
  annotation: FileSetAnnotation,
  fileSet: FileSetSource,
  annotationId: string,
  canvasId: string,
): Record<string, unknown> {
  return {
    id: annotationId,
    type: "Annotation",
    motivation: "commenting",
    body: buildSearchAnnotationBody(annotation),
    target: buildAnnotationTarget(canvasId, fileSet.work_id),
  };
}

function buildNavPlaceAnnotation(
  annotation: FileSetAnnotation,
  fileSet: FileSetSource,
  annotationId: string,
  canvasId: string,
): Record<string, unknown> {
  const featureCollection = parseJsonContent(annotation.content);

  return {
    id: annotationId,
    type: "Annotation",
    motivation: "tagging",
    body: [
      buildTextualBody(navPlaceSummary(featureCollection), annotation),
      featureCollection,
    ],
    target: buildAnnotationTarget(canvasId, fileSet.work_id),
  };
}

function buildGeoreferenceAnnotation(
  annotation: FileSetAnnotation,
  fileSet: FileSetSource,
  annotationId: string,
  canvasId: string,
): Record<string, unknown> {
  const georeference = parseJsonContent(annotation.content) as Record<
    string,
    unknown
  >;
  const body = georeference.body ?? georeference;

  return {
    ...georeference,
    id: annotationId,
    type: "Annotation",
    motivation: georeference.motivation || "georeferencing",
    body: [
      buildTextualBody(georeferenceSummary(georeference), annotation),
      body,
    ],
    target:
      georeference.target || buildAnnotationTarget(canvasId, fileSet.work_id),
  };
}

function buildTextualBody(
  value: string,
  annotation: FileSetAnnotation = { type: "" },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: "TextualBody",
    value,
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

function parseJsonContent(
  content: string | undefined,
): Record<string, unknown> {
  try {
    return JSON.parse(content ?? "");
  } catch (_error) {
    return {
      type: "TextualBody",
      value: content,
      format: "text/plain",
    };
  }
}

function navPlaceSummary(
  featureCollection: Record<string, unknown> = {},
): string {
  const features = Array.isArray(featureCollection.features)
    ? featureCollection.features
    : [];

  const labels = features
    .map((feature) => languageValue(feature?.properties?.label))
    .filter(Boolean);

  if (labels.length) return `Location: ${labels.join("; ")}`;

  return `Location annotation (${features.length} feature${
    features.length === 1 ? "" : "s"
  })`;
}

function georeferenceSummary(annotation: Record<string, unknown> = {}): string {
  const body = annotation.body as { features?: unknown[] } | undefined;
  const features = Array.isArray(body?.features) ? body.features : [];
  return `Georeference annotation (${features.length} control point${
    features.length === 1 ? "" : "s"
  })`;
}

function languageValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const values = obj.en || obj.none || Object.values(obj)[0];
  return languageValue(values);
}

export function navPlaceFromAnnotations(
  annotations: FileSetAnnotation[] = [],
): Record<string, unknown> | null {
  const navPlaceAnnotation = annotations.find(
    (annotation) =>
      annotation.type === "nav_place" && isSupportedAnnotation(annotation),
  );
  if (!navPlaceAnnotation) return null;

  const featureCollection = parseJsonContent(navPlaceAnnotation.content);
  return featureCollection?.type === "FeatureCollection"
    ? featureCollection
    : null;
}
