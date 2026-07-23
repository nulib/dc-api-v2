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
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
  testFixtureBytes,
} from "../test-helpers/index.ts";

// The IIIF base URL from the fixture is on the same host as OpenSearch
// collection-1234.json: representative_image.url = "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678"
// work-1234.json: representative_file_set.url = "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678"

function expectCorsHeaders(result: Response): void {
  expect(result.headers.get("Access-Control-Allow-Credentials")).toEqual(
    "true",
  );
  expect(result.headers.get("Access-Control-Allow-Origin")).toEqual(
    "https://test.example.edu/",
  );
}

describe("Thumbnail routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv({ API_TOKEN_SECRET: "abcdef" }));
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("Collection", () => {
    it("retrieves a thumbnail", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collection-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");
      expectCorsHeaders(result);
    });

    it("returns an error from the IIIF server", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collection-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse("Forbidden", {
              status: 403,
              headers: { "content-type": "text/plain" },
            }),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
      expect(await result.text()).toEqual("Forbidden");
      expectCorsHeaders(result);
    });

    it("returns 404 if the collection doc can't be found", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-collection-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the collection doc has no representative work", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/collection-1234-no-thumbnail.json"),
              ),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });
  });

  describe("Work", () => {
    it("retrieves a thumbnail", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");
      expectCorsHeaders(result);
    });

    it("retrieves a thumbnail from an ImageService3 base URL", async () => {
      const work = JSON.parse(testFixture("mocks/work-1234.json"));
      work._source.representative_file_set.url =
        "https://index.test.library.northwestern.edu/iiif/3/5678";

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () => HttpResponse.json(work),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/3/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");
      expectCorsHeaders(result);
    });

    it("returns an error from the IIIF server", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse("Forbidden", {
              status: 403,
              headers: { "content-type": "text/plain" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
      expect(await result.text()).toEqual("Forbidden");
      expectCorsHeaders(result);
    });

    it("returns 404 if the work doc can't be found", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the work doc has no thumbnail", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/work-1234-no-thumbnail.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 403 if the work is private", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("returns 200 if the work is private and the user is in the reading room", async () => {
      // Re-setup env with READING_ROOM_IPS for this test
      teardownEnv();
      setupEnv({ API_TOKEN_SECRET: "abcdef", READING_ROOM_IPS: "10.9.8.7" });

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        sourceIp: "10.9.8.7",
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("returns 404 if the work is unpublished", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("returns 200 if there is an entitlement for an unpublished, private work", async () => {
      const token = await new ApiToken().addEntitlement("1234").sign();

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/private-unpublished-work-1234.json"),
              ),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: "1234" },
        headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });
  });

  describe("FileSet", () => {
    it("retrieves a thumbnail for an Access image file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-image-access-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");
      expectCorsHeaders(result);
    });

    it("retrieves a thumbnail for an Auxiliary image file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-image-auxiliary-1234.json"),
              ),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expectCorsHeaders(result);
    });

    it("returns 404 for a non-image (audio) file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-audio-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 404 for a non-image (video) file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-video-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the file set doc can't be found", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 403 if the file set is private", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-private-image-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
      expectCorsHeaders(result);
    });

    it("returns 200 if the file set is private and the user is in the reading room", async () => {
      teardownEnv();
      setupEnv({ API_TOKEN_SECRET: "abcdef", READING_ROOM_IPS: "10.9.8.7" });

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-private-image-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        sourceIp: "10.9.8.7",
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("returns 200 for an institution file set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-institution-image-1234.json"),
              ),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expectCorsHeaders(result);
    });

    it("returns 404 if the file set is unpublished", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-unpublished-image-1234.json"),
              ),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expectCorsHeaders(result);
    });

    it("returns 200 for an unpublished file set if the user is a superuser", async () => {
      const token = await new ApiToken().superUser().sign();

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/fileset-unpublished-image-1234.json"),
              ),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("returns an error from the IIIF server", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-image-access-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/1234/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse("Forbidden", {
              status: 403,
              headers: { "content-type": "text/plain" },
            }),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: { origin: "https://test.example.edu/" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
      expect(await result.text()).toEqual("Forbidden");
      expectCorsHeaders(result);
    });
  });

  describe("Superuser", () => {
    it("retrieves thumbnail even if the work is private", async () => {
      const token = await new ApiToken().superUser().sign();

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: {
          authorization: `Bearer ${token}`,
          origin: "https://test.example.edu/",
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("retrieves thumbnail even if the work is unpublished", async () => {
      const token = await new ApiToken().superUser().sign();

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        headers: {
          authorization: `Bearer ${token}`,
          origin: "https://test.example.edu/",
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });
  });

  describe("QueryString parameters", () => {
    it("accepts a proper size", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!200,200/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { size: 200 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("rejects invalid sizes", async () => {
      const req1 = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { size: "foo" },
      });
      let result = await sendRequest(req1);
      expect(result.status).toEqual(400);
      expect(await result.text()).toContain("foo is not");

      const req2 = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { size: 500 },
      });
      result = await sendRequest(req2);
      expect(result.status).toEqual(400);
      expect(await result.text()).toContain("500px");
    });

    it("accepts proper aspect ratios", async () => {
      // full aspect
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/full/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_full.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/square/%5E!300,300/0/default.jpg",
          () =>
            new HttpResponse(testFixtureBytes("mocks/thumbnail_square.jpg"), {
              status: 200,
              headers: { "content-type": "image/jpeg" },
            }),
        ),
      );

      const req1 = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { aspect: "full" },
      });
      let result = await sendRequest(req1);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");

      const req2 = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { aspect: "square" },
      });
      result = await sendRequest(req2);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type")).toEqual("image/jpeg");
    });

    it("rejects improper aspect ratio", async () => {
      const req = buildRequest("GET", "/works/{id}/thumbnail", {
        pathParams: { id: 1234 },
        queryParams: { aspect: "foo" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(await result.text()).toContain("Unknown aspect ratio: foo");
    });
  });
});
