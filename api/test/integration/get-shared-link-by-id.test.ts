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
  cookieValue,
} from "../test-helpers/index.ts";

describe("Retrieve shared link by id", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("GET /shared-links/{id}", () => {
    it("retrieves a single shared link document", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/shared_links/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/shared-link-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/private-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/shared-links/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = await result.json();
      expect(resultBody.data.api_model).toEqual("Work");
      expect(resultBody.data.visibility).toEqual("Private");

      const dcApiCookie = cookieValue(
        result.headers.getSetCookie(),
        "dcapiTEST",
      );
      const token = await ApiToken.create(dcApiCookie.value);
      expect(token.hasEntitlement("1234")).toEqual(true);
    });

    it("404s a missing shared link", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/shared_links/_doc/5678",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-shared-link-5678.json")),
              { status: 404 },
            ),
        ),
      );

      const req = buildRequest("GET", "/shared-links/{id}", {
        pathParams: { id: 5678 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("404s an expired shared link", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/shared_links/_doc/9101112",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/expired-shared-link-9101112.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/shared-links/{id}", {
        pathParams: { id: 9101112 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });

    it("retrieves an unpublished single shared link document", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/shared_links/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/shared-link-1234.json")),
            ),
        ),
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

      const req = buildRequest("GET", "/shared-links/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = await result.json();
      expect(resultBody.data.api_model).toEqual("Work");
      expect(resultBody.data.visibility).toEqual("Private");
    });

    it("returns a 404 when the link exists but the work doesn't", async () => {
      server.use(
        http.get(
          "https://index.test.library.northwestern.edu/shared_links/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/shared-link-1234.json")),
            ),
        ),
        http.get(
          "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-work-1234.json")),
            ),
        ),
      );

      const req = buildRequest("GET", "/shared-links/{id}", {
        pathParams: { id: 1234 },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
    });
  });
});
