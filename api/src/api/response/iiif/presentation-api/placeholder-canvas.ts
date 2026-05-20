import type { FileSetSource } from "../types.ts";

export function buildPlaceholderCanvas(
  id: string,
  fileSet: FileSetSource,
  size = 640,
): Record<string, unknown> {
  const representative_image_url = fileSet.representative_image_url!;
  const { placeholderWidth, placeholderHeight } = getPlaceholderSizes(
    fileSet,
    size,
  );

  return {
    id: `${id}/placeholder`,
    type: "Canvas",
    width: placeholderWidth,
    height: placeholderHeight,
    items: [
      {
        id: `${id}/placeholder/annotation-page/0`,
        type: "AnnotationPage",
        items: [
          {
            id: `${id}/placeholder/annotation/0`,
            type: "Annotation",
            motivation: "painting",
            body: {
              id: `${representative_image_url}/full/!${placeholderWidth},${placeholderHeight}/0/default.jpg`,
              type: "Image",
              format: fileSet.mime_type,
              width: placeholderWidth,
              height: placeholderHeight,
              service: [
                {
                  ["@id"]: representative_image_url,
                  ["@type"]: "ImageService2",
                  profile: "http://iiif.io/api/image/2/level2.json",
                },
              ],
            },
            target: `${id}/placeholder`,
          },
        ],
      },
    ],
  };
}

export function getPlaceholderSizes(
  fileset: FileSetSource,
  size: number,
): { placeholderWidth: number; placeholderHeight: number } {
  const width = fileset.width ?? 100;
  const height = fileset.height ?? 100;
  const placeholderWidth = width > size ? size : width;
  const placeholderHeight = Math.floor((placeholderWidth / width) * height);
  return { placeholderWidth, placeholderHeight };
}
