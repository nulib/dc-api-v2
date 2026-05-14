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

describe("IIIF Search 2.0 for a file set", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /file-sets/{id}/search", () => {
    it("returns a IIIF Search 2.0 AnnotationPage with matching items", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body["@context"]).toEqual(
        "http://iiif.io/api/search/2/context.json",
      );
      expect(body.type).toEqual("AnnotationPage");
      expect(body.id).toContain("/file-sets/1234/search?as=iiif&q=Lorem");
      expect(body.items).toHaveLength(1);

      const item = body.items[0];
      expect(item.id).toEqual(
        `${process.env.DC_API_ENDPOINT}/annotations/36a47020-5410-4dda-a7ca-967fe3885bcd?as=iiif`,
      );
      expect(item.type).toEqual("Annotation");
      expect(item.motivation).toEqual("commenting");
      expect(item.body.type).toEqual("TextualBody");
      expect(item.body.value).toContain("Lorem");
      expect(item.body.format).toEqual("text/plain");
      expect(item.body.language).toEqual(["lg", "en"]);
      expect(item.target).toEqual({
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

    it("returns an empty items array when no annotations match", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-annotated-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "zzznomatch" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.type).toEqual("AnnotationPage");
      expect(body.items).toEqual([]);
    });

    it("returns 400 when q parameter is missing", async () => {
      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });

    it("returns 400 when as parameter is not iiif", async () => {
      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });

    it("returns 404 when the file set does not exist", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("returns 403 when the file set is private and no token is provided", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-restricted-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });
  });
});
