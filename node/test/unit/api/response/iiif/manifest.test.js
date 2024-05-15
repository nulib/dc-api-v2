"use strict";

const chai = require("chai");
const expect = chai.expect;

const { dcApiEndpoint, dcUrl } = requireSource("environment");
const transformer = requireSource("api/response/iiif/manifest");

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
    expect(getMetadataValueByLabel(manifest.metadata, "License")).to.eql([
      source.license.label,
    ]);
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

  it("populates Manifest logo", async () => {
    const { manifest } = await setup();
    const logo = manifest.logo[0];
    expect(logo.id).to.eq(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp"
    );
  });

  it("populates Manifest provider", async () => {
    const { manifest } = await setup();
    const provider = manifest.provider[0];
    expect(provider.id).to.eq("https://www.library.northwestern.edu/");
    expect(provider.label).to.deep.equal({
      none: ["Northwestern University Libraries"],
    });
    expect(provider.homepage[0].id).to.eq(
      "https://dc.library.northwestern.edu/"
    );
    expect(provider.homepage[0].label).to.deep.eq({
      none: ["Northwestern University Libraries Digital Collections Homepage"],
    });
    expect(provider.logo[0]).to.deep.eq({
      id: "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
      type: "Image",
      format: "image/webp",
      height: 139,
      width: 1190,
    });
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

  it("adds a placeholderCanvas property to Image canvases", async () => {
    const { manifest } = await setup();
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas.id).to.eq(`${manifest.items[0].id}/placeholder`);
    expect(placeholderCanvas.type).to.eq("Canvas");
  });

  it("excludes Preservation and Supplemental filesets", async () => {
    const { manifest } = await setup();
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

  it("includes partOf property only if Work has a Collection", async () => {
    const { manifest } = await setup();
    expect(manifest).to.have.property("partOf");

    async function setup2() {
      const response = {
        statusCode: 200,
        body: helpers.testFixture("mocks/work-1234-no-collection.json"),
      };
      const source = JSON.parse(response.body)._source;

      const result = await transformer.transform(response);
      expect(result.statusCode).to.eq(200);

      return { source, manifest: JSON.parse(result.body) };
    }
    const { manifest: manifest2 } = await setup2();
    expect(manifest2).to.not.have.property("partOf");
  });
});

describe("Image Work with fileset missing width and height as IIIF Manifest response transformer", () => {
  async function setup() {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/work-1234-no-fileset-width-height.json"),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    return { source, manifest: JSON.parse(result.body) };
  }

  it("sets canvas width and height to a default value", async () => {
    const { manifest } = await setup();
    const { width, height } = manifest.items[0];
    expect(width).to.eq(100);
    expect(height).to.eq(100);
  });

  it("sets canvas annotation body width and height to a default value", async () => {
    const { manifest } = await setup();
    const { width, height } = manifest.items[0].items[0].items[0].body;
    expect(width).to.eq(100);
    expect(height).to.eq(100);
  });

  it("excludes placeholderCanvas property on Image canvases if filset does not have width OR height", async () => {
    const { manifest } = await setup();
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas).to.eq(undefined);
  });
});

describe("Image Work with fileset missing representative_image_url", () => {
  async function setup() {
    const response = {
      statusCode: 200,
      body: helpers.testFixture(
        "mocks/work-1234-no-fileset-representative-image.json"
      ),
    };
    const source = JSON.parse(response.body)._source;

    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    return { source, manifest: JSON.parse(result.body) };
  }

  it("excludes placeholderCanvas property on Image canvases if filset does not have width OR height", async () => {
    const { manifest } = await setup();
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas).to.eq(undefined);
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
    expect(annotation.body.format).to.eq("application/x-mpegurl");
    expect(annotation.body.id).to.eq(source.file_sets[0].streaming_url);
  });

  it("renders a label for AnnotationPage with default value", async () => {
    const { manifest } = await setup();
    const annotationPageLabel = manifest.items[1].annotations[0].label["en"][0];
    expect(annotationPageLabel).to.eq("Chapters");
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
