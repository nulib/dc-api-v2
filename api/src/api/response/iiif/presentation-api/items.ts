import { dcApiEndpoint } from "../../../../environment.ts";
import type { CanvasInstanceBuilder } from "iiif-builder";
import type { FileSetAnnotation, FileSetSource } from "../types.ts";

export function addSupplementingAnnotationToCanvas(
  canvas: CanvasInstanceBuilder,
  canvasId: string,
  fileSet: FileSetSource,
): void {
  canvas.createAnnotationPage(
    `${canvasId}/annotations/page/0`,
    (annotationPageBuilder) => {
      annotationPageBuilder.addLabel("Chapters", "en");
      annotationPageBuilder.createAnnotation(
        buildSupplementingAnnotation({ canvasId, fileSet }),
      );
    },
    true,
  );
}

export function addThumbnailToCanvas(
  canvas: CanvasInstanceBuilder,
  fileSet: FileSetSource,
): void {
  if (fileSet.representative_image_url) {
    canvas.addThumbnail({
      id: buildImageResourceId(fileSet.representative_image_url),
      type: "Image",
      width: 300,
      height: 300,
      format: "image/jpeg",
      service: buildImageService(fileSet.representative_image_url),
    });
  }
}

export function annotationType(workType: string): string {
  return workType === "Audio" ? "Sound" : workType;
}

export function buildAnnotationBody(
  fileSet: FileSetSource,
  workType: string,
): Record<string, unknown> {
  const bodyType = annotationType(workType);
  const body: Record<string, unknown> = {
    id: buildAnnotationBodyId(fileSet, workType),
    type: bodyType,
    format: isAudioVideo(bodyType)
      ? "application/x-mpegurl"
      : fileSet.mime_type,
    height: fileSet.height ?? 100,
    width: fileSet.width ?? 100,
    label: { en: [fileSet.label ?? `Alternate ${workType}`] },
  };

  if (isImage(workType))
    body.service = buildImageService(fileSet.representative_image_url!);
  if (isAudioVideo(workType)) body.duration = fileSet.duration;
  return body;
}

export function buildAnnotationBodyId(
  fileSet: FileSetSource,
  workType: string,
): string {
  return isAudioVideo(workType)
    ? fileSet.streaming_url!
    : buildImageResourceId(fileSet.representative_image_url!, "600,");
}

export function buildImageResourceId(uri: string, size = "!300,300"): string {
  return `${uri}/full/${size}/0/default.jpg`;
}

export function buildImageService(
  representativeImageUrl: string,
): Record<string, unknown>[] {
  return [
    {
      id: representativeImageUrl,
      profile: "http://iiif.io/api/image/3/level2.json",
      type: "ImageService3",
    },
  ];
}

export function buildSupplementingAnnotation({
  canvasId,
  fileSet,
}: {
  canvasId: string;
  fileSet: FileSetSource;
}): Record<string, unknown> & { body: Record<string, unknown> } {
  return {
    id: `${canvasId}/annotations/page/0/a0`,
    type: "Annotation",
    motivation: "supplementing",
    body: {
      id: fileSet.webvtt,
      type: "Text",
      format: "text/vtt",
      language: "none",
    },
    target: canvasId,
  };
}

export function buildTranscriptionAnnotation({
  annotation,
  canvasId,
  pageId,
  index,
}: {
  annotation: FileSetAnnotation;
  canvasId: string;
  pageId: string;
  index: number;
}): Record<string, unknown> {
  return {
    id: `${pageId}/a${index}`,
    type: "Annotation",
    motivation: "commenting",
    body: buildTranscriptionBody(annotation),
    target: canvasId,
  };
}

function buildTranscriptionBody(
  annotation: FileSetAnnotation,
): Record<string, unknown> {
  const value = getTranscriptionContent(annotation);
  const body: Record<string, unknown> = {
    type: "TextualBody",
    value: value,
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

export function normalizeLanguages(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean) as string[];
  return [value as string];
}

export function getTranscriptionContent(
  annotation: FileSetAnnotation = { type: "" },
): string {
  return typeof annotation.content === "string" ? annotation.content : "";
}

export function hasTranscriptionContent(
  annotation: FileSetAnnotation,
): boolean {
  return getTranscriptionContent(annotation) !== "";
}

export function isAltFormat(mimeType: string): boolean {
  const acceptedTypes = [
    "application/pdf",
    "application/zip",
    "application/zip-compressed",
  ];
  return acceptedTypes.includes(mimeType);
}

export function isAudioVideo(type: string): boolean {
  return ["Audio", "Video", "Sound"].includes(type);
}

export function isImage(workType: string): boolean {
  return workType === "Image";
}

export function isPDF(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

// Re-export dcApiEndpoint usage helper (used internally by manifest.ts)
export { dcApiEndpoint };
