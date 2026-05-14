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
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

describe("Annotation routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /file-sets/{id}/annotations", () => {
    it("returns annotations for a file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/annotations", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(Array.isArray(body.data)).toEqual(true);
      expect(body.data.length).toEqual(1);
      expect(body.data[0].type).toEqual("transcription");
    });

    it("returns IIIF annotation page with annotations", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/annotations", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.type).toEqual("AnnotationPage");
      expect(Array.isArray(body.items)).toEqual(true);
      expect(body.items.length).toEqual(1);
      expect(body.items[0].id).toEqual(
        `${process.env.DC_API_ENDPOINT}/annotations/36a47020-5410-4dda-a7ca-967fe3885bcd?as=iiif`,
      );
      expect(body.items[0].type).toEqual("Annotation");
      expect(body.items[0].motivation).toEqual("commenting");
      expect(body.items[0].body.value).toBeDefined();
      expect(body.items[0].target).toEqual({
        type: "SpecificResource",
        source: {
          id: `${process.env.DC_API_ENDPOINT}/file-sets/1234?as=iiif`,
          type: "Canvas",
          partOf: [
            {
              id: `${process.env.DC_API_ENDPOINT}/works/work-1234?as=iiif`,
              type: "Manifest",
            },
          ],
        },
      });
    });

    it("returns IIIF annotation page with empty items when no annotations", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/annotations", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.type).toEqual("AnnotationPage");
      expect(Array.isArray(body.items)).toEqual(true);
      expect(body.items.length).toEqual(0);
    });
  });

  describe("GET /annotations/{id}", () => {
    it("returns a single annotation", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/annotation-search-hit.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/annotations/{id}", {
        pathParams: { id: "36a47020-5410-4dda-a7ca-967fe3885bcd" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.data.id).toEqual("36a47020-5410-4dda-a7ca-967fe3885bcd");
      expect(body.data.file_set_id).toEqual("1234");
      expect(body.data.work_id).toEqual("work-1234");
    });

    it("returns a IIIF contentState Annotation for ?as=iiif", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/annotation-search-hit.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/annotations/{id}", {
        pathParams: { id: "36a47020-5410-4dda-a7ca-967fe3885bcd" },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body["@context"]).toEqual(
        "http://iiif.io/api/presentation/3/context.json",
      );
      expect(body.type).toEqual("Annotation");
      expect(body.motivation).toEqual(["contentState", "commenting"]);
      expect(body.body.type).toEqual("TextualBody");
      expect(body.body.format).toEqual("text/plain");
      expect(typeof body.body.value).toEqual("string");
      expect(body.body.language).toBeDefined();
      expect(body.id).toContain(
        "/annotations/36a47020-5410-4dda-a7ca-967fe3885bcd?as=iiif",
      );
      expect(body.target).toEqual({
        type: "SpecificResource",
        source: {
          id: `${process.env.DC_API_ENDPOINT}/file-sets/1234?as=iiif`,
          type: "Canvas",
          partOf: [
            {
              id: `${process.env.DC_API_ENDPOINT}/works/work-1234?as=iiif`,
              type: "Manifest",
            },
          ],
        },
      });
    });
  });
});
