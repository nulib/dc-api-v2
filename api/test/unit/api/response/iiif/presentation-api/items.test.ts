import { describe, it, expect } from "bun:test";
import * as items from "../../../../../../src/api/response/iiif/presentation-api/items.ts";

describe("IIIF response presentation API items helpers", () => {
  const accessImage = {
    duration: undefined,
    height: 3024,
    id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
    label: "Access File - Tiff",
    mime_type: "image/tiff",
    original_filename: "Squirrel.tif",
    poster_offset: null,
    rank: 0,
    representative_image_url:
      "https://iiif.stack.rdc-staging.library.northwestern.edu/iiif/2/076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
    role: "Access" as const,
    streaming_url: undefined,
    webvtt: undefined,
    width: 4032,
  };

  it("annotationType(workType)", () => {
    expect(items.annotationType("Audio")).toEqual("Sound");
    expect(items.annotationType("Image")).toEqual("Image");
    expect(items.annotationType("Video")).toEqual("Video");
  });

  it("buildAnnotationBody(fileSet, workType)", () => {
    const body = items.buildAnnotationBody(accessImage, "Image");

    expect(String(body.id)).toContain(accessImage.representative_image_url);
    expect(body.width).toEqual(accessImage.width);
    expect(body.format).toEqual(accessImage.mime_type);
    expect((body.service as Array<{ id: string }>)[0].id).toEqual(
      accessImage.representative_image_url,
    );
  });

  it("buildAnnotationBodyId(fileSet, workType)", () => {
    const bodyId = items.buildAnnotationBodyId(accessImage, "Image");

    expect(bodyId).toEqual(
      `${accessImage.representative_image_url}/full/600,/0/default.jpg`,
    );
  });

  it('buildImageResourceId(representativeImageUrl, size = "!300,300")', () => {
    expect(
      items.buildImageResourceId(accessImage.representative_image_url),
    ).toEqual(
      `${accessImage.representative_image_url}/full/!300,300/0/default.jpg`,
    );
    expect(
      items.buildImageResourceId(
        accessImage.representative_image_url,
        "1000,1000",
      ),
    ).toEqual(
      `${accessImage.representative_image_url}/full/1000,1000/0/default.jpg`,
    );
  });

  it("buildImageService(representativeImageUrl)", () => {
    const imageService = items.buildImageService(
      accessImage.representative_image_url,
    )[0];

    expect(imageService.id).toEqual(accessImage.representative_image_url);
    expect(imageService.profile).toEqual(
      "http://iiif.io/api/image/2/level2.json",
    );
    expect(imageService.type).toEqual("ImageService2");
  });

  it("buildSupplementingAnnotation({ canvasId, fileSet })", () => {
    const canvasId = "https://example.com/canvas/1";
    const annotation = items.buildSupplementingAnnotation({
      canvasId,
      fileSet: accessImage,
    });

    expect(annotation.id).toEqual(`${canvasId}/annotations/page/0/a0`);
    expect(annotation.type).toEqual("Annotation");
    expect(annotation.motivation).toEqual("supplementing");
    expect(annotation.body.id).toEqual(accessImage.webvtt);
    expect(annotation.body.type).toEqual("Text");
    expect(annotation.body.format).toEqual("text/vtt");
    expect(annotation.body.language).toEqual("none");
    expect(annotation.target).toEqual(canvasId);
  });

  it("isAudioVideo(workType)", () => {
    expect(items.isAudioVideo("Audio")).toEqual(true);
    expect(items.isAudioVideo("Image")).toEqual(false);
    expect(items.isAudioVideo("Sound")).toEqual(true);
    expect(items.isAudioVideo("Video")).toEqual(true);
  });

  it("isImage(workType)", () => {
    expect(items.isImage("Audio")).toEqual(false);
    expect(items.isImage("Image")).toEqual(true);
    expect(items.isImage("Video")).toEqual(false);
  });
});
