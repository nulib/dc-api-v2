import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "bun:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  transform,
  annotationBody,
  bodyType,
} from "../../../../../src/api/response/iiif/canvas.ts";
import type { FileSetSource } from "../../../../../src/api/response/iiif/types.ts";
import { dcApiEndpoint } from "../../../../../src/environment.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
  osUrl,
} from "../../../../test-helpers/index.ts";

describe("FileSet as IIIF Canvas response transformer", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  async function setup(fixture = "mocks/fileset-image-canvas-1234.json") {
    const response = {
      status: 200,
      body: testFixture(fixture),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transform(response);
    expect(result.status).toEqual(200);

    return { source, canvas: await result.json() };
  }

  it("transforms an image file set response to a Canvas", async () => {
    const { source, canvas } = await setup();

    expect(canvas["@context"]).toEqual(
      "http://iiif.io/api/presentation/3/context.json",
    );
    expect(canvas.id).toEqual(
      `${dcApiEndpoint()}/file-sets/${source.id}?as=iiif`,
    );
    expect(canvas.type).toEqual("Canvas");
    expect(canvas.label.none[0]).toEqual(source.label);
    expect(canvas.summary.none[0]).toEqual(source.description);
    expect(canvas.width).toEqual(source.width);
    expect(canvas.height).toEqual(source.height);
    expect(canvas.thumbnail[0].id).toEqual(
      `${source.representative_image_url}/full/!300,300/0/default.jpg`,
    );
    expect(canvas.service).toContainEqual({
      id: `${dcApiEndpoint()}/file-sets/${source.id}/search?as=iiif`,
      type: "SearchService2",
    });
  });

  it("builds a painting annotation for image file sets", async () => {
    const { source, canvas } = await setup();
    const annotationPage = canvas.items[0];
    const annotation = annotationPage.items[0];

    expect(annotationPage.id).toEqual(`${canvas.id}/annotation-page`);
    expect(annotationPage.type).toEqual("AnnotationPage");
    expect(annotation.id).toEqual(`${canvas.id}/annotation/0`);
    expect(annotation.type).toEqual("Annotation");
    expect(annotation.motivation).toEqual("painting");
    expect(annotation.target).toEqual(canvas.id);
    expect(annotation.body).toMatchObject({
      id: `${source.representative_image_url}/full/600,/0/default.jpg`,
      type: "Image",
      format: source.mime_type,
      width: source.width,
      height: source.height,
    });
    expect(annotation.body.service[0]).toEqual({
      id: source.representative_image_url,
      type: "ImageService2",
      profile: "http://iiif.io/api/image/2/level2.json",
    });
  });

  it("adds placeholderCanvas for image file sets with dimensions", async () => {
    const { source, canvas } = await setup();

    expect(canvas.placeholderCanvas.id).toEqual(`${canvas.id}/placeholder`);
    expect(canvas.placeholderCanvas.type).toEqual("Canvas");
    expect(canvas.placeholderCanvas.width).toEqual(640);
    expect(canvas.placeholderCanvas.height).toEqual(877);
    expect(canvas.placeholderCanvas.items[0].items[0].body.id).toEqual(
      `${source.representative_image_url}/full/!640,877/0/default.jpg`,
    );
  });

  it("adds partOf from indexed work id and work title", async () => {
    const { source, canvas } = await setup();

    expect(canvas.partOf).toEqual([
      {
        id: `${dcApiEndpoint()}/works/${source.work_id}?as=iiif`,
        type: "Manifest",
        label: { en: [source.work_title] },
      },
    ]);
  });

  it("fetches parent work title when work title is not indexed", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    delete responseBody._source.work_title;

    server.use(
      http.get(
        osUrl(new RegExp(`/_doc/${responseBody._source.work_id}$`)),
        () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
      ),
    );

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.partOf[0].label.en[0]).toEqual("Canary Record TEST 1");
  });

  it("falls back to work id when parent work title cannot be fetched", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    delete responseBody._source.work_title;

    server.use(
      http.get(
        osUrl(new RegExp(`/_doc/${responseBody._source.work_id}$`)),
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/missing-work-1234.json")),
            { status: 404 },
          ),
      ),
    );

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.partOf[0].label.en[0]).toEqual(responseBody._source.work_id);
  });

  it("maps non-image mime types to IIIF body types", () => {
    expect(bodyType({ mime_type: "audio/mp3" } as FileSetSource)).toEqual(
      "Sound",
    );
    expect(bodyType({ mime_type: "video/mp4" } as FileSetSource)).toEqual(
      "Video",
    );
    expect(bodyType({ mime_type: "application/pdf" } as FileSetSource)).toEqual(
      "Text",
    );
    expect(bodyType({ mime_type: "application/zip" } as FileSetSource)).toEqual(
      "Dataset",
    );
  });

  it("builds annotation bodies for non-image file sets", () => {
    const audio = annotationBody(
      {
        id: "audio-123",
        label: "Audio",
        mime_type: "audio/mp3",
        streaming_url: "https://example.com/audio.m3u8",
        duration: 12.5,
        role: "Access" as const,
      },
      { width: 100, height: 100 },
    );
    const video = annotationBody(
      {
        id: "video-123",
        label: "Video",
        mime_type: "video/mp4",
        streaming_url: "https://example.com/video.m3u8",
        duration: 25,
        role: "Access" as const,
      },
      { width: 640, height: 480 },
    );
    const pdf = annotationBody(
      {
        id: "pdf-123",
        label: "PDF",
        mime_type: "application/pdf",
        download_url: "https://example.com/file.pdf",
        role: "Access" as const,
      },
      { width: 100, height: 100 },
    );
    const zip = annotationBody(
      {
        id: "zip-123",
        label: "ZIP",
        mime_type: "application/zip",
        download_url: "https://example.com/file.zip",
        role: "Access" as const,
      },
      { width: 100, height: 100 },
    );

    expect(audio).toMatchObject({
      id: "https://example.com/audio.m3u8",
      type: "Sound",
      format: "audio/mp3",
      duration: 12.5,
    });
    expect(video).toMatchObject({
      id: "https://example.com/video.m3u8",
      type: "Video",
      format: "video/mp4",
      width: 640,
      height: 480,
      duration: 25,
    });
    expect(pdf).toMatchObject({
      id: "https://example.com/file.pdf",
      type: "Text",
      format: "application/pdf",
    });
    expect(zip).toMatchObject({
      id: "https://example.com/file.zip",
      type: "Dataset",
      format: "application/zip",
    });
  });

  it("adds annotations reference for Image Access file sets with transcriptions", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    responseBody._source.annotations = [
      { type: "transcription", content: "some text" },
    ];

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.annotations).toEqual([
      {
        id: `${dcApiEndpoint()}/file-sets/${responseBody._source.id}/annotations?as=iiif`,
        type: "AnnotationPage",
      },
    ]);
  });

  it("does not add annotations reference when mime_type is not image/", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    responseBody._source.mime_type = "video/mp4";
    responseBody._source.annotations = [
      { type: "transcription", content: "some text" },
    ];

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.annotations).toBeUndefined();
  });

  it("does not add annotations reference when role is not Access", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    responseBody._source.role = "Auxiliary";
    responseBody._source.annotations = [
      { type: "transcription", content: "some text" },
    ];

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.annotations).toBeUndefined();
  });

  it("does not add annotations reference when there are no transcription annotations", async () => {
    const responseBody = JSON.parse(
      testFixture("mocks/fileset-image-canvas-1234.json"),
    );
    responseBody._source.annotations = [{ type: "other", content: "nope" }];

    const result = await transform({
      status: 200,
      body: JSON.stringify(responseBody),
    });
    const canvas = await result.json();

    expect(canvas.annotations).toBeUndefined();
  });

  it("passes non-200 responses through error transformation", async () => {
    const result = await transform({ status: 404, body: "" });
    const body = await result.json();

    expect(result.status).toEqual(404);
    expect(body.error).toEqual("Not Found");
  });
});
