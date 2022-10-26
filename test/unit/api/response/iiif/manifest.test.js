"use strict";

const transformer = require("../../../../../src/api/response/iiif/manifest");
const chai = require("chai");
const expect = chai.expect;
const { dcApiEndpoint, dcUrl } = require("../../../../../src/aws/environment");

describe("Image Work as IIIF Manifest response transformer", () => {
  function getMetadataValueByLabel(metadataArray, targetLabel) {
    const foundObj = metadataArray.find(
      (item) => item.label.none[0] === targetLabel
    );
    return foundObj ? foundObj.value.none : undefined;
  }

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

  it("transforms an Image work response to minimal Manifest", async () => {
    const { manifest } = await setup();
    expect(manifest.type).to.eq("Manifest");
  });

  it("populates Manifest label", async () => {
    const { source, manifest } = await setup();
    expect(manifest.label.none[0]).to.eq(source.title);
  });

  it("populates Manifest summary", async () => {
    const { source, manifest } = await setup();
    expect(manifest.summary.none[0]).to.eq(source.description[0]);
  });

  it("populates Manifest metadata", async () => {
    const { source, manifest } = await setup();
    expect(
      getMetadataValueByLabel(manifest.metadata, "Alternate Title")[0]
    ).to.eq(source.alternate_title[0]);
    expect(getMetadataValueByLabel(manifest.metadata, "Abstract")).to.be
      .undefined;
  });

  it("populates Manifest requiredStatement", async () => {
    const { source, manifest } = await setup();
    expect(manifest.requiredStatement.label.none[0]).to.eq("Attribution");
    expect(manifest.requiredStatement.value.none[0]).to.eq(
      "Courtesy of Northwestern University Libraries"
    );
    expect(manifest.requiredStatement.value.none.includes(source.terms_of_use))
      .to.be.true;
  });

  it("populates Manifest rights", async () => {
    const { source, manifest } = await setup();
    expect(manifest.rights).to.eq(source.rights_statement.id);
  });

  it("populates Manifest thumbnail", async () => {
    const { source, manifest } = await setup();
    expect(manifest.thumbnail[0].id).to.eq(source.thumbnail);
  });

  it("populates Manifest seeAlso", async () => {
    const { source, manifest } = await setup();
    expect(manifest.seeAlso[0].id).to.eq(source.api_link);
    expect(manifest.seeAlso[0].type).to.eq("Dataset");
    expect(manifest.seeAlso[0].format).to.eq("application/json");
    expect(manifest.seeAlso[0].label.none[0]).to.eq(
      "Northwestern University Libraries Digital Collections API"
    );
  });

  it("populates Manifest homepage", async () => {
    const { source, manifest } = await setup();
    expect(manifest.homepage[0].id).to.eq(`${dcUrl()}/items/${source.id}`);
    expect(manifest.homepage[0].label.none[0]).to.eq(
      "Homepage at Northwestern University Libraries Digital Collections"
    );
  });

  it("populates Manifest partOf", async () => {
    const { source, manifest } = await setup();
    const partOf = manifest.partOf[0];
    expect(partOf.id).to.eq(
      `${dcApiEndpoint()}/collections/${source.collection.id}?as=iiif`
    );
    expect(partOf.type).to.eq("Collection");
    expect(partOf.label.none).to.be.an("array").that.is.not.empty;
    expect(partOf.summary.none).to.be.an("array").that.is.not.empty;
  });

  it("populates Manifest items (canvases)", async () => {
    const { source, manifest } = await setup();
    expect(manifest.items.length).to.eq(3);
    manifest.items.forEach((canvas) => {
      expect(canvas.type).to.eq("Canvas");
    });
    expect(manifest.items[0].width).to.eq(source.file_sets[0].width);
    expect(manifest.items[0].height).to.eq(source.file_sets[0].height);
    expect(manifest.items[0].label.none[0]).to.eq(source.file_sets[0].label);
    expect(manifest.items[0].thumbnail[0].id).contains(
      source.file_sets[0].representative_image_url
    );
  });

  it("excludes Preservation and Supplemental filesets", async () => {
    const { source, manifest } = await setup();
    manifest.items.forEach((canvas) => {
      expect(canvas.id).not.contains(["preservation", "supplemental"]);
    });
  });

  it("populates Annotation (painting) for Image fileset", async () => {
    const { source, manifest } = await setup();
    const annotation = manifest.items[0].items[0].items[0];
    expect(annotation.type).to.eq("Annotation");
    expect(annotation.motivation).to.eq("painting");
    expect(annotation.target).to.eq(manifest.items[0].id);
    expect(annotation.body.id).contains(
      source.file_sets[0].representative_image_url
    );
    expect(annotation.body.format).to.eq(source.file_sets[0].mime_type);
    expect(annotation.body.type).to.eq("Image");
    expect(annotation.body.width).to.eq(source.file_sets[0].width);
    expect(annotation.body.height).to.eq(source.file_sets[0].height);
    expect(annotation.body.service[0]["@id"]).to.eq(
      source.file_sets[0].representative_image_url
    );
  });
});

describe("A/V Work as IIIF Manifest response transformer", () => {
  async function setup() {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/work-video-5678.json"),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    return { source, manifest: JSON.parse(result.body) };
  }

  it("transforms a Video work response to minimal Manifest", async () => {
    const { manifest } = await setup();
    expect(manifest.type).to.eq("Manifest");
  });

  it("renders duration on AV canvases", async () => {
    const { manifest } = await setup();
    expect(manifest.items[0].duration).to.eq(5.599);
  });

  it("renders annotation for type: Sound and Video ", async () => {
    const { source, manifest } = await setup();
    const annotation = manifest.items[0].items[0].items[0];

    expect(annotation.body.duration).to.eq(5.599);
    expect(annotation.body.type).to.eq("Video");
    expect(annotation.body.id).to.eq(source.file_sets[0].streaming_url);
  });
});

describe("404 network response", () => {
  it("returns as expected", async () => {
    const response = {
      statusCode: 404,
      body: helpers.testFixture("mocks/missing-work-1234.json"),
    };
    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(404);
  });
});
