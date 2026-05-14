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

describe("Similar routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("paginates results using default size and page number", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-work/_search",
        () => HttpResponse.json(JSON.parse(testFixture("mocks/similar.json"))),
      ),
    );

    const req = buildRequest("GET", "/works/{id}/similar", {
      pathParams: { id: 1234 },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    expect(result.headers.get("content-type") ?? "").toMatch(
      /application\/json.*charset=UTF-8/i,
    );

    const body = await result.json();
    const url = new URL(body.pagination.query_url);
    expect(url.searchParams.has("searchToken")).toEqual(false);
    expect(url.searchParams.has("size")).toEqual(false);
  });

  it("paginates results using provided size and page number", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-work/_search",
        () => HttpResponse.json(JSON.parse(testFixture("mocks/similar.json"))),
      ),
    );

    const req = buildRequest("GET", "/works/{id}/similar", {
      pathParams: { id: 1234 },
      queryParams: { page: 3, size: 3 },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(200);
    expect(result.headers.get("content-type") ?? "").toMatch(
      /application\/json.*charset=UTF-8/i,
    );

    const resultBody = await result.json();
    expect(resultBody.pagination.current_page).toEqual(3);
    expect(resultBody.pagination.limit).toEqual(3);
    expect(resultBody.pagination.offset).toEqual(6);
    expect(resultBody.pagination.total_hits).toEqual(9);
    expect(resultBody.pagination.total_pages).toEqual(3);

    const url = new URL(resultBody.pagination.query_url);
    expect(url.searchParams.has("searchToken")).toEqual(false);
    expect(url.searchParams.get("size")).toEqual("3");
  });
});
