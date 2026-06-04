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
import * as opensearch from "../../../src/api/opensearch.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
} from "../../test-helpers/index.ts";

describe("getWork()", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("gets a work by its id", async () => {
    server.use(
      http.get(
        "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
        () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
      ),
    );

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body._source.api_model).toEqual("Work");
  });

  it("returns 404 Not Found for unpublished works", async () => {
    server.use(
      http.get(
        "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/unpublished-work-1234.json")),
          ),
      ),
    );

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(404);
    expect(body.found).toEqual(false);
  });

  it("returns 404 Not Found for missing documents", async () => {
    server.use(
      http.get(
        "https://index.test.library.northwestern.edu/dc-v2-work/_doc/1234",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/missing-work-1234.json")),
            { status: 404 },
          ),
      ),
    );

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(404);
    expect(body.found).toEqual(false);
  });
});

describe("getFileSet()", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("gets a fileset by its id", async () => {
    server.use(
      http.get(
        "https://index.test.library.northwestern.edu/dc-v2-file-set/_doc/1234",
        () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/fileset-1234.json"))),
      ),
    );

    const result = await opensearch.getFileSet("1234");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body._source.api_model).toEqual("FileSet");
  });
});

describe("getCollection()", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("gets a collection by its id", async () => {
    server.use(
      http.get(
        "https://index.test.library.northwestern.edu/dc-v2-collection/_doc/1234",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/collection-1234.json")),
          ),
      ),
    );

    const result = await opensearch.getCollection("1234");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body._source.api_model).toEqual("Collection");
  });
});

describe("getWorkFileSets()", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("gets file sets by work id", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/work-file-sets.json")),
          ),
      ),
    );

    const result = await opensearch.getWorkFileSets("work-123");
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body.hits.hits.length > 0).toBe(true);
  });

  it("filters by role when provided", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-file-set/_search",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/work-file-sets-access.json")),
          ),
      ),
    );

    const result = await opensearch.getWorkFileSets("work-123", {
      role: "Access",
    });
    expect(result.status).toEqual(200);
  });
});

describe("search()", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("performs searches", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-work/_search",
        () => HttpResponse.json(JSON.parse(testFixture("mocks/search.json"))),
      ),
    );

    const result = await opensearch.search(
      "dc-v2-work",
      "{ query: { match_all: {} } }",
    );
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body.hits.hits.length).toEqual(10);
    expect(body.hits.total.value).toEqual(4199);
  });

  it("can search multiple targets", async () => {
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-work,dc-v2-collection/_search",
        () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/search-multiple-targets.json")),
          ),
      ),
    );

    const result = await opensearch.search(
      "dc-v2-work,dc-v2-collection",
      "{ query: { match_all: {} } }",
    );
    const body = JSON.parse(result.body);
    expect(result.status).toEqual(200);
    expect(body.hits.hits.length).toEqual(10);
    expect(body.hits.total.value).toEqual(4331);
  });

  it("passes search query options to OpenSearch", async () => {
    const received: { searchPipeline: string | null } = {
      searchPipeline: null,
    };
    server.use(
      http.post(
        "https://index.test.library.northwestern.edu/dc-v2-work/_search",
        ({ request }) => {
          received.searchPipeline = new URL(request.url).searchParams.get(
            "search_pipeline",
          );
          return HttpResponse.json(
            JSON.parse(testFixture("mocks/search.json")),
          );
        },
      ),
    );

    const result = await opensearch.search(
      "dc-v2-work",
      "{ query: { match_all: {} } }",
      { search_pipeline: "dc-v2-work-pipeline" },
    );

    expect(result.status).toEqual(200);
    expect(received.searchPipeline).toEqual("dc-v2-work-pipeline");
  });
});
