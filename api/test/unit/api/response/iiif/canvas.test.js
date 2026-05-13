"use strict";

const chai = require("chai");
const expect = chai.expect;

const { dcApiEndpoint } = requireSource("environment");
const transformer = requireSource("api/response/iiif/canvas");

async function setup(fixture = "mocks/fileset-image-canvas-1234.json") {
  const response = {
    statusCode: 200,
    body: helpers.testFixture(fixture),
  };
  const source = JSON.parse(response.body)._source;

  const result = await transformer.transform(response);
  expect(result.statusCode).to.eq(200);

  return { source, canvas: JSON.parse(result.body) };
}

describe("FileSet as IIIF Canvas response transformer", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  it("transforms an image file set response to a Canvas", async () => {
    const { source, canvas } = await setup();

    expect(canvas["@context"]).to.eq(
      "http://iiif.io/api/presentation/3/context.json"
    );
    expect(canvas.id).to.eq(
      `${dcApiEndpoint()}/file-sets/${source.id}?as=iiif`
    );
    expect(canvas.type).to.eq("Canvas");
    expect(canvas.label.none[0]).to.eq(source.label);
    expect(canvas.summary.none[0]).to.eq(source.description);
    expect(canvas.width).to.eq(source.width);
    expect(canvas.height).to.eq(source.height);
    expect(canvas.thumbnail[0].id).to.eq(
      `${source.representative_image_url}/full/!300,300/0/default.jpg`
    );
  });

  it("builds a painting annotation for image file sets", async () => {
    const { source, canvas } = await setup();
    const annotationPage = canvas.items[0];
    const annotation = annotationPage.items[0];

    expect(annotationPage.id).to.eq(`${canvas.id}/annotation-page`);
    expect(annotationPage.type).to.eq("AnnotationPage");
    expect(annotation.id).to.eq(`${canvas.id}/annotation/0`);
    expect(annotation.type).to.eq("Annotation");
    expect(annotation.motivation).to.eq("painting");
    expect(annotation.target).to.eq(canvas.id);
    expect(annotation.body).to.deep.include({
      id: `${source.representative_image_url}/full/600,/0/default.jpg`,
      type: "Image",
      format: source.mime_type,
      width: source.width,
      height: source.height,
    });
    expect(annotation.body.service[0]).to.deep.eq({
      id: source.representative_image_url,
      type: "ImageService2",
      profile: "http://iiif.io/api/image/2/level2.json",
    });
  });

  it("adds placeholderCanvas for image file sets with dimensions", async () => {
    const { source, canvas } = await setup();

    expect(canvas.placeholderCanvas.id).to.eq(`${canvas.id}/placeholder`);
    expect(canvas.placeholderCanvas.type).to.eq("Canvas");
    expect(canvas.placeholderCanvas.width).to.eq(640);
    expect(canvas.placeholderCanvas.height).to.eq(877);
    expect(canvas.placeholderCanvas.items[0].items[0].body.id).to.eq(
      `${source.representative_image_url}/full/!640,877/0/default.jpg`
    );
  });

  it("adds partOf from indexed work id and work title", async () => {
    const { source, canvas } = await setup();

    expect(canvas.partOf).to.deep.eq([
      {
        id: `${dcApiEndpoint()}/works/${source.work_id}?as=iiif`,
        type: "Manifest",
        label: { en: [source.work_title] },
      },
    ]);
  });

  it("fetches parent work title when work title is not indexed", async () => {
    const responseBody = JSON.parse(
      helpers.testFixture("mocks/fileset-image-canvas-1234.json")
    );
    delete responseBody._source.work_title;

    mock
      .get(`/dc-v2-work/_doc/${responseBody._source.work_id}`)
      .reply(200, helpers.testFixture("mocks/work-1234.json"));

    const result = await transformer.transform({
      statusCode: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = JSON.parse(result.body);

    expect(canvas.partOf[0].label.en[0]).to.eq("Canary Record TEST 1");
  });

  it("falls back to work id when parent work title cannot be fetched", async () => {
    const responseBody = JSON.parse(
      helpers.testFixture("mocks/fileset-image-canvas-1234.json")
    );
    delete responseBody._source.work_title;

    mock
      .get(`/dc-v2-work/_doc/${responseBody._source.work_id}`)
      .reply(404, helpers.testFixture("mocks/missing-work-1234.json"));

    const result = await transformer.transform({
      statusCode: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = JSON.parse(result.body);

    expect(canvas.partOf[0].label.en[0]).to.eq(responseBody._source.work_id);
  });

  it("maps non-image mime types to IIIF body types", () => {
    expect(transformer.bodyType({ mime_type: "audio/mp3" })).to.eq("Sound");
    expect(transformer.bodyType({ mime_type: "video/mp4" })).to.eq("Video");
    expect(transformer.bodyType({ mime_type: "application/pdf" })).to.eq(
      "Text"
    );
    expect(transformer.bodyType({ mime_type: "application/zip" })).to.eq(
      "Dataset"
    );
  });

  it("builds annotation bodies for non-image file sets", () => {
    const audio = transformer.annotationBody(
      {
        id: "audio-123",
        label: "Audio",
        mime_type: "audio/mp3",
        streaming_url: "https://example.com/audio.m3u8",
        duration: 12.5,
      },
      { width: 100, height: 100 }
    );
    const video = transformer.annotationBody(
      {
        id: "video-123",
        label: "Video",
        mime_type: "video/mp4",
        streaming_url: "https://example.com/video.m3u8",
        duration: 25,
      },
      { width: 640, height: 480 }
    );
    const pdf = transformer.annotationBody(
      {
        id: "pdf-123",
        label: "PDF",
        mime_type: "application/pdf",
        download_url: "https://example.com/file.pdf",
      },
      { width: 100, height: 100 }
    );
    const zip = transformer.annotationBody(
      {
        id: "zip-123",
        label: "ZIP",
        mime_type: "application/zip",
        download_url: "https://example.com/file.zip",
      },
      { width: 100, height: 100 }
    );

    expect(audio).to.include({
      id: "https://example.com/audio.m3u8",
      type: "Sound",
      format: "audio/mp3",
      duration: 12.5,
    });
    expect(video).to.include({
      id: "https://example.com/video.m3u8",
      type: "Video",
      format: "video/mp4",
      width: 640,
      height: 480,
      duration: 25,
    });
    expect(pdf).to.include({
      id: "https://example.com/file.pdf",
      type: "Text",
      format: "application/pdf",
    });
    expect(zip).to.include({
      id: "https://example.com/file.zip",
      type: "Dataset",
      format: "application/zip",
    });
  });

  it("passes non-200 responses through error transformation", async () => {
    const result = await transformer.transform({ statusCode: 404 });
    const body = JSON.parse(result.body);

    expect(result.statusCode).to.eq(404);
    expect(body.error).to.eq("Not Found");
  });
});
