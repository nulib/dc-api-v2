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

describe("Retrieve work by id", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /works/{id}", () => {
    it("retrieves a single work document", async () => {
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

      const body = await result.json();
      expect(body.data.id).toEqual("1234");
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

    it("returns a single work as a IIIF Manifest", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
        http.post(
          "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
          () =>
            HttpResponse.json({
              hits: {
                total: { value: 2 },
                hits: [
                  {
                    _source: {
                      id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
                      annotations: [],
                    },
                  },
                  {
                    _source: {
                      id: "51862c1c-c024-45dc-ab26-694bd8ebc16c",
                      annotations: [],
                    },
                  },
                ],
              },
            }),
        ),
      );

      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: 1234 },
        queryParams: { as: "iiif" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/json.*charset=UTF-8/i,
      );
      expect(result.headers.get("vary") ?? "").toMatch(/Accept/i);

      const body = await result.json();
      expect(body.type).toEqual("Manifest");
      expect(body["@context"]).toEqual(
        "http://iiif.io/api/presentation/3/context.json",
      );
      expect(body.label.none[0]).toEqual("Canary Record TEST 1");
      expect(body.service).toEqual(
        expect.arrayContaining([
          {
            id: `${process.env["DC_API_ENDPOINT"]}/works/1234/search?as=iiif`,
            type: "SearchService2",
          },
        ]),
      );
    });

    it("will retrieve a private, unpublished work document with an entitlement", async () => {
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
      );

      const token = await new ApiToken().addEntitlement("1234").sign();
      const req = buildRequest("GET", "/works/{id}", {
        pathParams: { id: "1234" },
        headers: { cookie: `dcapiTEST=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const body = await result.json();
      expect(body.data.id).toEqual("1234");
    });
  });
});
