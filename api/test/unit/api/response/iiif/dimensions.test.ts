import { describe, expect, it } from "bun:test";
import { dimensions } from "../../../../../src/api/response/iiif/dimensions.ts";
import type { FileSetSource } from "../../../../../src/api/response/iiif/types.ts";

const image: FileSetSource = {
  id: "2029d173-a0c8-453d-8566-b8aabc216691",
  role: "Auxiliary",
  mime_type: "image/jpeg",
  width: 224,
  height: 1351,
};

function rotated(orientation?: string | number): FileSetSource {
  return {
    ...image,
    extracted_metadata: {
      exif: { value: { imageWidth: 224, imageHeight: 1351, orientation } },
    },
  };
}

describe("oriented IIIF dimensions", () => {
  for (const orientation of [
    5,
    6,
    7,
    8,
    "5",
    "6",
    "7",
    "8",
    "Rotate 90 CW",
    "Rotate 270 CW",
    "Mirror horizontal and rotate 270 CW",
    "Mirror horizontal and rotate 90 CW",
  ]) {
    it(`swaps axes for EXIF ${orientation}`, () => {
      expect(dimensions(rotated(orientation))).toEqual({
        width: 1351,
        height: 224,
      });
    });
  }

  for (const orientation of [
    undefined,
    1,
    2,
    3,
    4,
    "Horizontal (normal)",
    "Mirror horizontal",
    "Rotate 180",
    "Mirror vertical",
    "unknown",
  ]) {
    it(`preserves axes for EXIF ${orientation}`, () => {
      expect(dimensions(rotated(orientation))).toEqual({
        width: 224,
        height: 1351,
      });
    });
  }

  it("uses EXIF dimensions when stored dimensions are absent", () => {
    expect(
      dimensions({ ...rotated(8), width: undefined, height: undefined }),
    ).toEqual({ width: 1351, height: 224 });
  });

  it("leaves video dimensions unchanged even with orientation metadata", () => {
    expect(dimensions({ ...rotated(8), mime_type: "video/mp4" })).toEqual({
      width: 224,
      height: 1351,
    });
  });

  it("retains the missing-dimension fallback", () => {
    expect(
      dimensions({ ...image, width: undefined, height: undefined }),
    ).toEqual({ width: 100, height: 100 });
  });
});
