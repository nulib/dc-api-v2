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
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  osUrl,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts"; // updated

// Matches the first Access file set in mocks/work-1234.json
const annotatedFileSetsResponse = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _source: {
          id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
          group_with: null,
          annotations: [
            {
              id: "anno-uuid-1",
              type: "transcription",
              language: ["en"],
              content:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae nisl a leo faucibus consectetur.",
              model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
            },
          ],
        },
      },
    ],
  },
};

// Matches the second Access file set in mocks/work-1234.json
const annotatedSecondFileSetsResponse = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _source: {
          id: "51862c1c-c024-45dc-ab26-694bd8ebc16c",
          group_with: null,
          annotations: [
            {
              id: "anno-uuid-2",
              type: "transcription",
              language: ["en"],
              content:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae nisl a leo faucibus consectetur.",
              model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
            },
          ],
        },
      },
    ],
  },
};

const emptyFileSetsResponse = {
  hits: {
    total: { value: 0 },
    hits: [],
  },
};

describe("IIIF Search 2.0 for a work", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /works/{id}/search", () => {
    it("returns a IIIF Search 2.0 AnnotationPage with matching items", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.post(osUrl(/\/_search$/), () =>
          HttpResponse.json(annotatedFileSetsResponse),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/search", {
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
      expect(body.id).toContain("?as=iiif&q=Lorem");
      expect(body.items).toHaveLength(1);

      const item = body.items[0];
      expect(item.type).toEqual("Annotation");
      expect(item.motivation).toEqual("commenting");
      expect(item.body.type).toEqual("TextualBody");
      expect(item.body.value).toContain("Lorem");
      expect(item.body.format).toEqual("text/plain");
      expect(item.body.language).toEqual("en");
      expect(item.target).toEqual({
        type: "SpecificResource",
        source: {
          id: `${process.env.DC_API_ENDPOINT}/file-sets/076dcbd8-8c57-40e8-bdf7-dc9153c87a36?as=iiif`,
          type: "Canvas",
          partOf: [
            {
              id: `${process.env.DC_API_ENDPOINT}/works/1234?as=iiif`,
              type: "Manifest",
            },
          ],
        },
      });
    });

    it("targets the correct file-set canvas from the manifest ordering, not sequential search result order", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.post(osUrl(/\/_search$/), () =>
          HttpResponse.json(annotatedSecondFileSetsResponse),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.items).toHaveLength(1);
      // Second Access file set in work-1234.json must map to its standalone Canvas URI
      expect(body.items[0].target).toEqual({
        type: "SpecificResource",
        source: {
          id: `${process.env.DC_API_ENDPOINT}/file-sets/51862c1c-c024-45dc-ab26-694bd8ebc16c?as=iiif`,
          type: "Canvas",
          partOf: [
            {
              id: `${process.env.DC_API_ENDPOINT}/works/1234?as=iiif`,
              type: "Manifest",
            },
          ],
        },
      });
    });

    it("returns an empty items array when no annotations match", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.post(osUrl(/\/_search$/), () =>
          HttpResponse.json(annotatedFileSetsResponse),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/search", {
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
      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });

    it("returns 400 when as parameter is not iiif", async () => {
      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
    });

    it("returns 404 when the work does not exist", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("returns 403 when the work is private and no token is provided", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("returns results for a private work with a valid entitlement token", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
        http.post(osUrl(/\/_search$/), () =>
          HttpResponse.json(emptyFileSetsResponse),
        ),
      );

      const token = await new ApiToken().addEntitlement("1234").sign();
      const req = buildRequest("GET", "/works/{id}/search", {
        pathParams: { id: "1234" },
        queryParams: { as: "iiif", q: "Lorem" },
        cookies: [["dcapiTEST", token]],
      });

      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.type).toEqual("AnnotationPage");
    });
  });
});
