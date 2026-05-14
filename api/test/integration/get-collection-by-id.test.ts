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

describe("Retrieve collection by id", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /collections/{id}", () => {
    it("retrieves a single collection link document", async () => {
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
      expect(resultBody.data.id).toEqual("1234");
    });

    it("404s a missing collection", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-collection-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("403's if the collection is private", async () => {
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
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(403);
    });

    it("200's if the collection is private but the user is in the reading room", async () => {
      process.env["READING_ROOM_IPS"] = "10.9.8.7";

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
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
    });

    it("returns a single collection as a IIIF collection", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/collection-1234.json")),
            ),
        ),
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Collection");
      expect(resultBody.label.none[0]).toEqual("Collection Title");
    });

    it("redirects to /collections when id is missing or empty", async () => {
      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: "" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(301);
      expect(result.headers.get("location") ?? "").toContain("/collections");
    });

    it("returns a private IIIF collection if the user is in the reading room", async () => {
      process.env["READING_ROOM_IPS"] = "10.9.8.7";

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
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-work/_search",
          () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
        ),
      );

      const req = buildRequest("GET", "/collections/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
      const resultBody = await result.json();
      expect(resultBody.type).toEqual("Collection");
      expect(resultBody.label.none[0]).toEqual("Collection Title");
    });
  });
});
