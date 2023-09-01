"use strict";

const chai = require("chai");
const expect = chai.expect;

const items = requireSource("api/response/iiif/presentation-api/items");

describe("IIIF response presentation API items helpers", () => {
  const accessImage = {
    duration: null,
    height: 3024,
    id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
    label: "Access File - Tiff",
    mime_type: "image/tiff",
    original_filename: "Squirrel.tif",
    poster_offset: null,
    rank: 0,
    representative_image_url:
      "https://iiif.stack.rdc-staging.library.northwestern.edu/iiif/2/076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
    role: "Access",
    streaming_url: null,
    webvtt: null,
    width: 4032,
  };

  // const accessAudio = {
  //   duration: null,
  //   height: 3024,
  //   id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
  //   label: "Access File - Tiff",
  //   mime_type: "image/tiff",
  //   original_filename: "Squirrel.tif",
  //   poster_offset: null,
  //   rank: 0,
  //   representative_image_url:
  //     "https://iiif.stack.rdc-staging.library.northwestern.edu/iiif/2/076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
  //   role: "Access",
  //   streaming_url: null,
  //   webvtt: null,
  //   width: 4032,
  // };

  it("annotationType(workType)", () => {
    expect(items.annotationType("Audio")).to.eq("Sound");
    expect(items.annotationType("Image")).to.eq("Image");
    expect(items.annotationType("Video")).to.eq("Video");
  });

  it("buildAnnotationBody(fileSet, workType)", () => {
    const body = items.buildAnnotationBody(accessImage, "Image");

    expect(body.id).contains(accessImage.representative_image_url);
    expect(body.width).to.eq(accessImage.width);
    expect(body.format).to.eq(accessImage.mime_type);
    expect(body.service[0].id).to.eq(accessImage.representative_image_url);
  });

  it("buildAnnotationBody(fileSet, workType)", () => {
    const bodyId = items.buildAnnotationBodyId(accessImage, "Image");

    expect(bodyId).eq(
      `${accessImage.representative_image_url}/full/600,/0/default.jpg`
    );
  });

  it('buildImageResourceId(representativeImageUrl,size = "!300,300")', () => {
    expect(
      items.buildImageResourceId(accessImage.representative_image_url)
    ).to.eq(
      `${accessImage.representative_image_url}/full/!300,300/0/default.jpg`
    );
    expect(
      items.buildImageResourceId(
        accessImage.representative_image_url,
        "1000,1000"
      )
    ).to.eq(
      `${accessImage.representative_image_url}/full/1000,1000/0/default.jpg`
    );
  });

  it("buildImageService(representativeImageUrl)", () => {
    const imageService = items.buildImageService(
      accessImage.representative_image_url
    )[0];

    expect(imageService.id).to.eq(accessImage.representative_image_url);
    expect(imageService.profile).to.eq(
      "http://iiif.io/api/image/2/level2.json"
    );
    expect(imageService.type).to.eq("ImageService2");
  });

  it("isAudioVideo(workType)", () => {
    expect(items.isAudioVideo("Audio")).to.be.true;
    expect(items.isAudioVideo("Image")).to.be.false;
    expect(items.isAudioVideo("Sound")).to.be.true;
    expect(items.isAudioVideo("Video")).to.be.true;
  });

  it("isImage(workType)", () => {
    expect(items.isImage("Audio")).to.be.false;
    expect(items.isImage("Image")).to.be.true;
    expect(items.isImage("Video")).to.be.false;
  });
});
