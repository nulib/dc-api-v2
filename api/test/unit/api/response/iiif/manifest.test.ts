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
import { transform } from "../../../../../src/api/response/iiif/manifest.ts";
import { dcApiEndpoint, dcUrl } from "../../../../../src/environment.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
  osUrl,
} from "../../../../test-helpers/index.ts";

const emptyFileSetResponse = JSON.stringify({
  hits: { total: { value: 0 }, hits: [] },
});

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  setupEnv();
  // Allow any POST to the file-set search endpoint (for transcription lookups)
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

async function setup(fixture = "mocks/work-1234.json") {
  const response = {
    status: 200,
    body: testFixture(fixture),
  };
  const source = JSON.parse(response.body)._source;

  const result = await transform(response);
  expect(result.status).toEqual(200);

  return { source, manifest: await result.json() };
}

function getMetadataValueByLabel(
  metadataArray: Array<{
    label: { none: string[] };
    value: { none: string[] };
  }>,
  targetLabel: string,
): string[] | undefined {
  const foundObj = metadataArray.find(
    (item) => item.label.none[0] === targetLabel,
  );
  return foundObj ? foundObj.value.none : undefined;
}

describe("Image Work as IIIF Manifest response transformer", () => {
  it("transforms an Image work response to minimal Manifest", async () => {
    const { manifest } = await setup();
    expect(manifest.type).toEqual("Manifest");
  });

  it("populates Manifest label", async () => {
    const { source, manifest } = await setup();
    expect(manifest.label.none[0]).toEqual(source.title);
  });

  it("populates Manifest summary", async () => {
    const { source, manifest } = await setup();
    expect(manifest.summary.none[0]).toEqual(source.description[0]);
  });

  it("populates Manifest metadata", async () => {
    const { source, manifest } = await setup();
    expect(
      getMetadataValueByLabel(manifest.metadata, "Alternate Title")![0],
    ).toEqual(source.alternate_title[0]);
    expect(getMetadataValueByLabel(manifest.metadata, "Abstract")).toEqual(
      undefined,
    );
    expect(getMetadataValueByLabel(manifest.metadata, "License")).toEqual([
      source.license.label,
    ]);
  });

  it("populates Manifest requiredStatement", async () => {
    const { source, manifest } = await setup();
    expect(manifest.requiredStatement.label.none[0]).toEqual("Attribution");
    expect(manifest.requiredStatement.value.none[0]).toEqual(
      "Courtesy of Northwestern University Libraries",
    );
    expect(
      manifest.requiredStatement.value.none.includes(source.terms_of_use),
    ).toBe(true);
  });

  it("populates Manifest rights", async () => {
    const { source, manifest } = await setup();
    expect(manifest.rights).toEqual(source.rights_statement.id);
  });

  it("populates Manifest thumbnail", async () => {
    const { source, manifest } = await setup();
    expect(manifest.thumbnail[0].id).toEqual(source.thumbnail);
  });

  it("populates Manifest seeAlso", async () => {
    const { source, manifest } = await setup();
    expect(manifest.seeAlso[0].id).toEqual(source.api_link);
    expect(manifest.seeAlso[0].type).toEqual("Dataset");
    expect(manifest.seeAlso[0].format).toEqual("application/json");
    expect(manifest.seeAlso[0].label.none[0]).toEqual(
      "Northwestern University Libraries Digital Collections API",
    );
  });

  it("populates Manifest homepage", async () => {
    const { source, manifest } = await setup();
    expect(manifest.homepage[0].id).toEqual(`${dcUrl()}/items/${source.id}`);
    expect(manifest.homepage[0].label.none[0]).toEqual(
      "Homepage at Northwestern University Libraries Digital Collections",
    );
  });

  it("populates Manifest navPlace with point features", async () => {
    const { manifest } = await setup();
    expect(manifest.navPlace).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "https://sws.geonames.org/1275004/",
          geometry: {
            type: "Point",
            coordinates: [88.3639, 22.5726],
          },
          properties: {
            label: { en: ["Calcutta"] },
            summary: { en: ["British survey depot"] },
          },
        },
      ],
    });
  });

  it("omits navPlace when source has no navPlace data", async () => {
    const { manifest } = await setup("mocks/work-1234-no-collection.json");
    expect(manifest.navPlace).toEqual(undefined);
  });

  it("populates Manifest partOf", async () => {
    const { source, manifest } = await setup();
    const partOf = manifest.partOf[0];
    expect(partOf.id).toEqual(
      `${dcApiEndpoint()}/collections/${source.collection.id}?as=iiif`,
    );
    expect(partOf.type).toEqual("Collection");
    expect(
      Array.isArray(partOf.label.none) && partOf.label.none.length > 0,
    ).toBe(true);
    expect(
      Array.isArray(partOf.summary.none) && partOf.summary.none.length > 0,
    ).toBe(true);
  });

  it("populates Manifest logo", async () => {
    const { manifest } = await setup();
    const logo = manifest.logo[0];
    expect(logo.id).toEqual(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
    );
  });

  it("populates Manifest provider", async () => {
    const { manifest } = await setup();
    const provider = manifest.provider[0];
    expect(provider.id).toEqual("https://www.library.northwestern.edu/");
    expect(provider.label).toEqual({
      none: ["Northwestern University Libraries"],
    });
    expect(provider.homepage[0].id).toEqual(
      "https://dc.library.northwestern.edu/",
    );
    expect(provider.homepage[0].label).toEqual({
      none: ["Northwestern University Libraries Digital Collections Homepage"],
    });
    expect(provider.logo[0]).toEqual({
      id: "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
      type: "Image",
      format: "image/webp",
      height: 139,
      width: 1190,
    });
  });

  it("populates Manifest items (canvases)", async () => {
    const { source, manifest } = await setup();
    expect(manifest.items.length).toEqual(3);
    for (const canvas of manifest.items) {
      expect(canvas.type).toEqual("Canvas");
    }
    expect(manifest.items[0].id).toEqual(
      `${dcApiEndpoint()}/file-sets/${source.file_sets[0].id}?as=iiif`,
    );
    expect(manifest.items[0].items[0].id).toEqual(
      `${manifest.items[0].id}/annotation-page`,
    );
    expect(manifest.items[0].width).toEqual(source.file_sets[0].width);
    expect(manifest.items[0].height).toEqual(source.file_sets[0].height);
    expect(manifest.items[0].label.none[0]).toEqual(source.file_sets[0].label);
    expect(
      String(manifest.items[0].thumbnail[0].id).includes(
        source.file_sets[0].representative_image_url,
      ),
    ).toBe(true);
  });

  it("adds a placeholderCanvas property to Image canvases", async () => {
    const { manifest } = await setup();
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas.id).toEqual(`${manifest.items[0].id}/placeholder`);
    expect(placeholderCanvas.type).toEqual("Canvas");
  });

  it("excludes Preservation and Supplemental filesets", async () => {
    const { manifest } = await setup();
    for (const canvas of manifest.items) {
      expect(!String(canvas.id).includes("preservation")).toBe(true);
      expect(!String(canvas.id).includes("supplemental")).toBe(true);
    }
  });

  it("populates Annotation (painting) for Image fileset", async () => {
    const { source, manifest } = await setup();
    const annotation = manifest.items[0].items[0].items[0];
    expect(annotation.type).toEqual("Annotation");
    expect(annotation.motivation).toEqual("painting");
    expect(annotation.target).toEqual(manifest.items[0].id);
    expect(
      String(annotation.body.id).includes(
        source.file_sets[0].representative_image_url,
      ),
    ).toBe(true);
    expect(annotation.body.format).toEqual(source.file_sets[0].mime_type);
    expect(annotation.body.type).toEqual("Image");
    expect(annotation.body.width).toEqual(source.file_sets[0].width);
    expect(annotation.body.height).toEqual(source.file_sets[0].height);
    expect(annotation.body.service[0].id).toEqual(
      source.file_sets[0].representative_image_url,
    );
    expect(annotation.body.service[0].type).toEqual(
      "ImageService3",
    );
    expect(annotation.body.service[0].profile).toEqual(
      "http://iiif.io/api/image/3/level2.json",
    );
  });

  it("includes partOf property only if Work has a Collection", async () => {
    const { manifest } = await setup();
    expect("partOf" in manifest).toBe(true);

    const { manifest: manifest2 } = await setup(
      "mocks/work-1234-no-collection.json",
    );
    expect(!("partOf" in manifest2)).toBe(true);
  });

  it("handles behavior property on Manifest", async () => {
    const { manifest } = await setup();
    expect("behavior" in manifest).toBe(true);
    expect(
      Array.isArray(manifest.behavior) && manifest.behavior.length > 0,
    ).toBe(true);
    expect(manifest.behavior[0]).toEqual("individuals");

    const { manifest: manifest2 } = await setup(
      "mocks/work-1234-no-behavior.json",
    );
    expect(!("behavior" in manifest2)).toBe(true);
  });
});

describe("Image Work with fileset missing width and height as IIIF Manifest response transformer", () => {
  it("sets canvas width and height to a default value", async () => {
    const { manifest } = await setup(
      "mocks/work-1234-no-fileset-width-height.json",
    );
    const { width, height } = manifest.items[0];
    expect(width).toEqual(100);
    expect(height).toEqual(100);
  });

  it("sets canvas annotation body width and height to a default value", async () => {
    const { manifest } = await setup(
      "mocks/work-1234-no-fileset-width-height.json",
    );
    const { width, height } = manifest.items[0].items[0].items[0].body;
    expect(width).toEqual(100);
    expect(height).toEqual(100);
  });

  it("excludes placeholderCanvas property on Image canvases if fileset does not have width OR height", async () => {
    const { manifest } = await setup(
      "mocks/work-1234-no-fileset-width-height.json",
    );
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas).toEqual(undefined);
  });
});

describe("Image Work with fileset missing representative_image_url", () => {
  it("excludes placeholderCanvas property on Image canvases if fileset does not have representative_image_url", async () => {
    const { manifest } = await setup(
      "mocks/work-1234-no-fileset-representative-image.json",
    );
    const { placeholderCanvas } = manifest.items[0];
    expect(placeholderCanvas).toEqual(undefined);
  });
});

describe("A/V Work as IIIF Manifest response transformer", () => {
  it("transforms a Video work response to minimal Manifest", async () => {
    const { manifest } = await setup("mocks/work-video-5678.json");
    expect(manifest.type).toEqual("Manifest");
  });

  it("renders duration on AV canvases", async () => {
    const { manifest } = await setup("mocks/work-video-5678.json");
    expect(manifest.items[0].duration).toEqual(5.599);
  });

  it("renders annotation for type: Sound and Video", async () => {
    const { source, manifest } = await setup("mocks/work-video-5678.json");
    const annotation = manifest.items[0].items[0].items[0];

    expect(annotation.body.duration).toEqual(5.599);
    expect(annotation.body.type).toEqual("Video");
    expect(annotation.body.format).toEqual("application/x-mpegurl");
    expect(annotation.body.id).toEqual(source.file_sets[0].streaming_url);
  });

  it("renders a label for AnnotationPage with default value", async () => {
    const { manifest } = await setup("mocks/work-video-5678.json");
    const annotationPageLabel = manifest.items[1].annotations[0].label["en"][0];
    expect(annotationPageLabel).toEqual("Chapters");
  });
});

describe("404 network response", () => {
  it("returns as expected", async () => {
    const response = {
      status: 404,
      body: testFixture("mocks/missing-work-1234.json"),
    };
    const result = await transform(response);
    expect(result.status).toEqual(404);
  });
});

describe("IIIF Multiple Choice of Images in a Single View", () => {
  it("creates a Choice annotation when there are alternate file sets", async () => {
    const { manifest } = await setup("mocks/work-1234-choice.json");
    expect(manifest.type).toEqual("Manifest");
    expect(Array.isArray(manifest.items) && manifest.items.length > 0).toBe(
      true,
    );

    for (const canvas of manifest.items) {
      const annotation = canvas.items[0]?.items[0];
      expect(annotation).toBeDefined();
      expect(annotation.body).toBeDefined();

      if (annotation.body.type === "Choice") {
        expect(
          Array.isArray(annotation.body.items) &&
            annotation.body.items.length > 0,
        ).toBe(true);
      }
    }
  });

  it("ensures the primary file set appears first in the Choice annotation", async () => {
    const { manifest, source } = await setup("mocks/work-1234-choice.json");

    // Group file sets by `group_with` field
    const fileSetGroups: Record<string, unknown[]> = {};
    for (const fileSet of source.file_sets) {
      const groupKey = fileSet.group_with || fileSet.id;
      if (!fileSetGroups[groupKey]) {
        fileSetGroups[groupKey] = [];
      }
      fileSetGroups[groupKey].push(fileSet);
    }

    for (const canvas of manifest.items) {
      const annotation = canvas.items[0]?.items[0];
      expect(annotation).toBeDefined();
      expect(annotation.body).toBeDefined();

      if (annotation.body.type === "Choice") {
        const choiceItems = annotation.body.items as Array<{ id: string }>;
        expect(Array.isArray(choiceItems) && choiceItems.length > 0).toBe(true);

        // Find the group of file sets this canvas corresponds to
        const expectedGroup = Object.values(fileSetGroups).find((group) =>
          (group as Array<{ id: string }>).some((fs) =>
            choiceItems.some((ci) => ci.id.includes(fs.id)),
          ),
        ) as Array<{ id: string; group_with?: string }> | undefined;

        expect(expectedGroup).toBeDefined();

        // Determine the primary file set
        const primaryFileSet =
          expectedGroup!.find((fs) =>
            expectedGroup!.some((gfs) => gfs.group_with === fs.id),
          ) || expectedGroup![0];

        const firstChoiceItemId = choiceItems[0]?.id;
        expect(firstChoiceItemId.includes(primaryFileSet.id)).toBe(true);
      }
    }
  });

  it("does not create a Choice annotation when there is only one file set", async () => {
    const { manifest } = await setup("mocks/work-1234-choice.json");

    for (const canvas of manifest.items) {
      const annotation = canvas.items[0]?.items[0];
      expect(annotation).toBeDefined();
      expect(annotation.body).toBeDefined();

      if (Array.isArray(annotation.body.items)) {
        expect(annotation.body.items.length > 0).toBe(true);
      } else {
        expect(annotation.body.type !== "Choice").toBe(true);
      }
    }
  });
});
