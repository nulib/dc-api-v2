import { dcApiEndpoint } from "../../../environment.ts";
import { getWork } from "../../opensearch.ts";
import { transformError } from "../error.ts";
import {
  buildImageResourceId,
  buildImageService,
} from "./presentation-api/items.ts";
import { buildPlaceholderCanvas } from "./presentation-api/placeholder-canvas.ts";
import {
  navPlaceFromAnnotations,
  supportedAnnotations,
} from "./annotation-helpers.ts";
import type { FileSetSource } from "./types.ts";

export async function transform(
  response: { status: number; body: string },
  options: { allowPrivate?: boolean; allowUnpublished?: boolean } = {},
): Promise<Response> {
  if (response.status !== 200) return transformError(response);

  const openSearchResponse = JSON.parse(response.body) as {
    _source: FileSetSource;
  };
  const fileSet = openSearchResponse._source;
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const { width, height } = getDimensions(fileSet);

  const canvas: Record<string, unknown> = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: canvasId,
    type: "Canvas",
    width,
    height,
    label: { none: [label(fileSet)] },
    items: [annotationPage(canvasId, fileSet, { width, height })],
    service: [
      {
        id: `${dcApiEndpoint()}/file-sets/${fileSet.id}/search?as=iiif`,
        type: "SearchService2",
      },
    ],
  };

  if (fileSet.description) {
    canvas.summary = { none: [fileSet.description] };
  }

  if (fileSet.representative_image_url) {
    canvas.thumbnail = [
      {
        id: buildImageResourceId(fileSet.representative_image_url),
        type: "Image",
        width: 300,
        height: 300,
        format: "image/jpeg",
        service: buildImageService(fileSet.representative_image_url),
      },
    ];
  }

  if (
    isImage(fileSet) &&
    fileSet.representative_image_url &&
    fileSetWidth(fileSet) &&
    fileSetHeight(fileSet)
  ) {
    canvas.placeholderCanvas = buildPlaceholderCanvas(canvasId, {
      ...fileSet,
      width,
      height,
    });
  }

  const partOf = await parentManifest(fileSet, options);
  if (partOf) {
    canvas.partOf = [partOf];
  }

  const annotations = supportedAnnotations(fileSet.annotations || []);
  if (
    /^image\//i.test(fileSet.mime_type as string) &&
    fileSet.role === "Access" &&
    annotations.length
  ) {
    canvas.annotations = [
      {
        id: `${dcApiEndpoint()}/file-sets/${fileSet.id}/annotations?as=iiif`,
        type: "AnnotationPage",
      },
    ];
  }

  const navPlace = navPlaceFromAnnotations(annotations);
  if (navPlace) {
    canvas.navPlace = navPlace;
  }

  return new Response(JSON.stringify(canvas), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function annotationPage(
  canvasId: string,
  fileSet: FileSetSource,
  dims: { width: number; height: number },
): Record<string, unknown> {
  const pageId = `${canvasId}/annotation-page`;
  return {
    id: pageId,
    type: "AnnotationPage",
    items: [
      {
        id: `${canvasId}/annotation/0`,
        type: "Annotation",
        motivation: "painting",
        target: canvasId,
        body: annotationBody(fileSet, dims),
      },
    ],
  };
}

export function annotationBody(
  fileSet: FileSetSource,
  { width, height }: { width: number; height: number },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: bodyId(fileSet),
    type: bodyType(fileSet),
    format: fileSet.mime_type,
    label: { en: [label(fileSet)] },
  };

  if (["Image", "Video"].includes(body.type as string)) {
    body.width = width;
    body.height = height;
  }

  if (body.type === "Image" && fileSet.representative_image_url) {
    body.service = buildImageService(fileSet.representative_image_url);
  }

  if (["Sound", "Video"].includes(body.type as string) && fileSet.duration) {
    body.duration = fileSet.duration;
  }

  return body;
}

function bodyId(fileSet: FileSetSource): string {
  if (isImage(fileSet) && fileSet.representative_image_url) {
    return buildImageResourceId(fileSet.representative_image_url, "600,");
  }
  return (
    fileSet.streaming_url ||
    fileSet.download_url ||
    fileSet.api_link ||
    `${dcApiEndpoint()}/file-sets/${fileSet.id}`
  );
}

export function bodyType(fileSet: FileSetSource): string {
  const mimeType = fileSet.mime_type || "";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("audio/")) return "Sound";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType === "application/pdf") return "Text";
  return "Dataset";
}

export function dimensions(fileSet: FileSetSource): {
  width: number;
  height: number;
} {
  return getDimensions(fileSet);
}

function getDimensions(fileSet: FileSetSource): {
  width: number;
  height: number;
} {
  return {
    width: fileSetWidth(fileSet) || 100,
    height: fileSetHeight(fileSet) || 100,
  };
}

function fileSetWidth(fileSet: FileSetSource): number | undefined {
  return fileSet.width || fileSet.extracted_metadata?.exif?.value?.imageWidth;
}

function fileSetHeight(fileSet: FileSetSource): number | undefined {
  return fileSet.height || fileSet.extracted_metadata?.exif?.value?.imageHeight;
}

function isImage(fileSet: FileSetSource): boolean {
  return fileSet.mime_type.startsWith("image/");
}

function label(fileSet: FileSetSource): string {
  return fileSet.label || fileSet.original_filename || fileSet.id;
}

async function parentManifest(
  fileSet: FileSetSource,
  options: { allowPrivate?: boolean; allowUnpublished?: boolean },
): Promise<Record<string, unknown> | null> {
  if (!fileSet.work_id) return null;

  return {
    id: `${dcApiEndpoint()}/works/${fileSet.work_id}?as=iiif`,
    type: "Manifest",
    label: { en: [await workTitle(fileSet, options)] },
  };
}

async function workTitle(
  fileSet: FileSetSource,
  options: { allowPrivate?: boolean; allowUnpublished?: boolean },
): Promise<string> {
  if (fileSet.work_title) return fileSet.work_title;

  let response: { status: number; body: string };
  try {
    response = await getWork(fileSet.work_id!, {
      allowPrivate: options.allowPrivate,
      allowUnpublished: options.allowUnpublished,
    });
  } catch (_error) {
    return fileSet.work_id!;
  }
  if (response.status !== 200) return fileSet.work_id!;

  return (
    (JSON.parse(response.body) as { _source?: { title?: string } })?._source
      ?.title || fileSet.work_id!
  );
}
