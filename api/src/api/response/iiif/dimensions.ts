import type { FileSetSource } from "./types.ts";

/** Dimensions in the image service's oriented coordinate space, not stored pixels. */
export function fileSetDimensions(fileSet: FileSetSource): {
  width: number | undefined;
  height: number | undefined;
} {
  const exif = fileSet.extracted_metadata?.exif?.value;
  const width = fileSet.width || exif?.imageWidth;
  const height = fileSet.height || exif?.imageHeight;
  if (!fileSet.mime_type?.startsWith("image/")) return { width, height };

  // ExifTool emits descriptive strings; numeric EXIF values are also accepted.
  const orientation = String(exif?.orientation ?? "").trim();
  const swapsAxes =
    /^[5-8]$/.test(orientation) ||
    /^(?:Rotate (?:90|270) CW|Mirror horizontal and rotate (?:90|270) CW)$/i.test(
      orientation,
    );
  return swapsAxes ? { width: height, height: width } : { width, height };
}

export function dimensions(fileSet: FileSetSource): {
  width: number;
  height: number;
} {
  const { width, height } = fileSetDimensions(fileSet);
  return { width: width || 100, height: height || 100 };
}
