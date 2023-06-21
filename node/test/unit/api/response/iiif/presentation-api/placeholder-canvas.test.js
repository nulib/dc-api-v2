"use strict";

const chai = require("chai");
const expect = chai.expect;
const transformer = requireSource("api/response/iiif/manifest");
const { buildPlaceholderCanvas, getPlaceholderSizes } = requireSource(
  "api/response/iiif/presentation-api/placeholder-canvas"
);

describe("IIIF response presentation API placeholderCanvas helpers", () => {
  async function setup() {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/work-1234.json"),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    return { source, manifest: JSON.parse(result.body) };
  }

  it("buildPlaceholderCanvas(value)", async () => {
    const { source, manifest } = await setup();
    const id = manifest.items[0].id;
    const fileSet = source.file_sets[0];
    const placeholder = buildPlaceholderCanvas(id, fileSet, 640);

    expect(placeholder.id).to.eq(`${id}/placeholder`);
    expect(placeholder.type).to.eq("Canvas");
    expect(placeholder.width).to.eq(640);
    expect(placeholder.height).to.eq(480);
    expect(placeholder.items[0].id).to.eq(
      `${id}/placeholder/annotation-page/0`
    );
    expect(placeholder.items[0].type).to.eq("AnnotationPage");
    expect(placeholder.items[0].items[0].type).to.eq("Annotation");
    expect(placeholder.items[0].items[0].motivation).to.eq("painting");
    expect(placeholder.items[0].items[0].body.id).to.eq(
      `${fileSet.representative_image_url}/full/!640,480/0/default.jpg`
    );
    expect(placeholder.items[0].items[0].body.type).to.eq("Image");
    expect(placeholder.items[0].items[0].body.format).to.eq(fileSet.mime_type);
    expect(placeholder.items[0].items[0].body.width).to.eq(640);
    expect(placeholder.items[0].items[0].body.height).to.eq(480);
    expect(placeholder.items[0].items[0].body.service[0]["@id"]).to.eq(
      fileSet.representative_image_url
    );
  });

  it("getPlaceholderSizes(fileSet, size)", () => {
    const fileSet = {
      width: 3125,
      height: 2240,
    };

    const { placeholderHeight, placeholderWidth } = getPlaceholderSizes(
      fileSet,
      1000
    );

    expect(placeholderWidth).to.eq(1000);
    expect(placeholderHeight).to.eq(716);
  });
});
