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
} from "../test-helpers/index.ts";

describe("Doc retrieval routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /works/{id}", () => {
    it("retrieves a single work", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      expect(resultBody.data.api_model).toEqual("Work");
      expect(resultBody.data.id).toEqual("1234");
    });

    it("404s a missing work", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("404s an unpublished work", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("403's a private work by default", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("returns a private work to allowed IPs", async () => {
      process.env["READING_ROOM_IPS"] = "10.9.8.7";
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });
  });

  describe("GET /collections/{id}", () => {
    it("retrieves a single collection", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collection-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      expect(resultBody.data.api_model).toEqual("Collection");
      expect(resultBody.data.id).toEqual("1234");
    });

    it("403s a private collection", async () => {
      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: 1234 },
      });

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(
                testFixture("mocks/collection-1234-private-published.json"),
              ),
            ),
        ),
      );

      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });
  });

  describe("GET /file-sets/{id}", () => {
    it("retrieves a single file-set", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );

      const resultBody = await result.json();
      expect(resultBody.data.api_model).toEqual("FileSet");
      expect(resultBody.data.id).toEqual("1234");
    });

    it("returns a single file-set as a IIIF Canvas", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-image-canvas-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/file-sets/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json/,
      );

      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Canvas");
      expect(resultBody["@context"]).toEqual(
        "http://iiif.io/api/presentation/3/context.json",
      );
      expect(resultBody.id).toEqual(
        `${process.env["DC_API_ENDPOINT"]}/file-sets/1234?as=iiif`,
      );
      expect(resultBody.partOf[0]).toEqual({
        id: `${process.env["DC_API_ENDPOINT"]}/works/20f1cd93-7851-4646-af07-0b544661569f?as=iiif`,
        type: "Manifest",
        label: { en: ["L'Isole Britanniche (1811)"] },
      });
    });

    it("403s a private file-set", async () => {
      const req = buildRequest("GET", "/file-sets/{id}", {
        pathParams: { id: 1234 },
      });

      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/fileset-restricted-1234.json")),
            ),
        ),
      );

      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });
  });

  describe("GET /file-sets/{id}/annotations", () => {
    it("returns annotations for a file-set", async () => {
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

    it("returns null when no annotations exist", async () => {
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
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.data).toEqual(null);
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
    });

    it("404s when annotation is missing", async () => {
      server.use(
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/annotation-search-empty.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/annotations/{id}", {
        pathParams: { id: "missing" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });
  });

  describe("Superuser", () => {
    describe("works", () => {
      it("returns an unpublished work", async () => {
        const token = await new ApiToken().superUser().sign();
        server.use(
          http.get(
            "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
            () =>
              HttpResponse.json(
                JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
              ),
          ),
        );

        const req = buildRequest("GET", "/works/{id}", {
          pathParams: { id: 1234 },
          headers: { authorization: `Bearer ${token}` },
        });
        const result = await sendRequest(req);
        expect(result.status).toEqual(200);
      });

      it("returns a private work", async () => {
        const token = await new ApiToken().superUser().sign();
        server.use(
          http.get(
            "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
            () =>
              HttpResponse.json(
                JSON.parse(testFixture("mocks/private-work-1234.json")),
              ),
          ),
        );

        const req = buildRequest("GET", "/works/{id}", {
          pathParams: { id: 1234 },
          headers: { authorization: `Bearer ${token}` },
        });
        const result = await sendRequest(req);
        expect(result.status).toEqual(200);
      });
    });

    describe("collections", () => {
      it("returns a private collection", async () => {
        const token = await new ApiToken().superUser().sign();
        server.use(
          http.get(
            "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
            () =>
              HttpResponse.json(
                JSON.parse(
                  testFixture("mocks/collection-1234-private-published.json"),
                ),
              ),
          ),
        );

        const req = buildRequest("GET", "/collections/{id}", {
          pathParams: { id: 1234 },
          headers: { authorization: `Bearer ${token}` },
        });
        const result = await sendRequest(req);
        expect(result.status).toEqual(200);
      });
    });

    describe("file sets", () => {
      it("returns a private file-set", async () => {
        const token = await new ApiToken().superUser().sign();
        server.use(
          http.get(
            "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
            () =>
              HttpResponse.json(
                JSON.parse(testFixture("mocks/fileset-restricted-1234.json")),
              ),
          ),
        );

        const req = buildRequest("GET", "/file-sets/{id}", {
          pathParams: { id: 1234 },
          headers: { authorization: `Bearer ${token}` },
        });
        const result = await sendRequest(req);
        expect(result.status).toEqual(200);
      });
    });
  });
});
