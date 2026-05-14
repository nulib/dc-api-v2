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
import { transform } from "../../../../../../src/api/response/iiif/manifest.ts";
import {
  buildPlaceholderCanvas,
  getPlaceholderSizes,
} from "../../../../../../src/api/response/iiif/presentation-api/placeholder-canvas.ts";
import type { FileSetSource } from "../../../../../../src/api/response/iiif/types.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
  osUrl,
} from "../../../../../test-helpers/index.ts";

const emptyFileSetResponse = JSON.stringify({
  hits: { total: { value: 0 }, hits: [] },
});

describe("IIIF response presentation API placeholderCanvas helpers", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    setupEnv();
    server.use(
      http.post(osUrl(/\/_search$/), () =>
        HttpResponse.json(JSON.parse(emptyFileSetResponse)),
      ),
    );
  });
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  async function setup() {
    const response = {
      status: 200,
      body: testFixture("mocks/work-1234.json"),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transform(response);
    expect(result.status).toEqual(200);

    return { source, manifest: await result.json() };
  }

  it("buildPlaceholderCanvas(id, fileSet, size)", async () => {
    const { source, manifest } = await setup();
    const id = manifest.items[0].id;
    const fileSet = source.file_sets[0];
    const placeholder = buildPlaceholderCanvas(id, fileSet, 640);

    expect(placeholder.id).toEqual(`${id}/placeholder`);
    expect(placeholder.type).toEqual("Canvas");
    expect(placeholder.width).toEqual(640);
    expect(placeholder.height).toEqual(480);

    const annotPage = (placeholder.items as Record<string, unknown>[])[0];
    expect(annotPage.id).toEqual(`${id}/placeholder/annotation-page/0`);
    expect(annotPage.type).toEqual("AnnotationPage");

    const annotation = (annotPage.items as Record<string, unknown>[])[0];
    expect(annotation.type).toEqual("Annotation");
    expect(annotation.motivation).toEqual("painting");

    const body = annotation.body as Record<string, unknown>;
    expect(body.id).toEqual(
      `${fileSet.representative_image_url}/full/!640,480/0/default.jpg`,
    );
    expect(body.type).toEqual("Image");
    expect(body.format).toEqual(fileSet.mime_type);
    expect(body.width).toEqual(640);
    expect(body.height).toEqual(480);
    expect((body.service as Array<Record<string, unknown>>)[0]["@id"]).toEqual(
      fileSet.representative_image_url,
    );
  });

  it("getPlaceholderSizes(fileSet, size)", () => {
    const fileSets = [
      { width: 3125, height: 2240 },
      { width: 500, height: 300 },
      { width: null, height: null },
    ];

    const expected = [
      { placeholderWidth: 1000, placeholderHeight: 716 },
      { placeholderWidth: 500, placeholderHeight: 300 },
      { placeholderWidth: 100, placeholderHeight: 100 },
    ];

    fileSets.forEach((fileSet, index) => {
      const { placeholderHeight, placeholderWidth } = getPlaceholderSizes(
        fileSet as unknown as FileSetSource,
        1000,
      );
      expect(placeholderWidth).toEqual(expected[index].placeholderWidth);
      expect(placeholderHeight).toEqual(expected[index].placeholderHeight);
    });
  });
});
