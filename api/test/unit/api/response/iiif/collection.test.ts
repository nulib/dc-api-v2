import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { transform } from "../../../../../src/api/response/iiif/collection.ts";
import { Paginator } from "../../../../../src/api/pagination.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
} from "../../../../test-helpers/index.ts";

describe("IIIF Collection response transformer", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  let pager: Paginator;

  beforeEach(() => {
    pager = new Paginator(
      "http://dcapi.library.northwestern.edu/api/v2/",
      "search",
      ["works"],
      { query: { query_string: { query: "genre.label:architecture" } } },
      "iiif",
      {
        includeToken: false,
        queryStringParameters: {
          collectionLabel: "The collection label",
          collectionSummary: "The collection Summary",
          query: "genre.label:architecture",
        },
      },
    );
  });

  it("transforms a search response", async () => {
    const response = {
      status: 200,
      body: testFixture("mocks/search.json"),
    };
    const result = await transform(response, pager);
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(body.type).toEqual("Collection");
    expect(body.label.none[0]).toEqual("The collection label");
  });

  it("transforms an error response", async () => {
    const response = {
      status: 404,
      body: testFixture("mocks/missing-index.json"),
    };

    const result = await transform(response, pager);
    expect(result.status).toEqual(404);

    const body = await result.json();
    expect(body.status).toEqual(404);
    expect(typeof body.error === "string").toBe(true);
  });

  it("handles a request including /similar route", async () => {
    const pagerWorkSimilar = new Paginator(
      "http://dcapi.library.northwestern.edu/api/v2/",
      "works/1234/similar",
      ["works"],
      { query: { query_string: { query: "genre.label:architecture" } } },
      "iiif",
      {
        includeToken: false,
        queryStringParameters: {
          collectionLabel: "The collection label",
          collectionSummary: "The collection Summary",
        },
      },
    );

    const response = {
      status: 200,
      body: testFixture("mocks/search.json"),
    };
    const result = await transform(response, pagerWorkSimilar);
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(body.homepage[0].id).toContain("search?similar=1234");
  });
});

describe("IIIF Collection response for top level collections", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  const pager = new Paginator(
    "http://dcapi.library.northwestern.edu/api/v2/",
    "collections",
    ["collections"],
    { query: { match_all: {} } },
    "iiif",
    {
      includeToken: false,
      parameterOverrides: { as: "iiif" },
      queryStringParameters: {
        as: "iiif",
        collectionLabel:
          "Northwestern University Libraries Digital Collections",
        collectionSummary:
          "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials.",
      },
    },
  );

  it("transforms a collection of collections response", async () => {
    const response = {
      status: 200,
      body: testFixture("mocks/collections.json"),
    };

    const result = await transform(response, pager);
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(body.type).toEqual("Collection");
    expect(body.label.none[0]).toEqual(
      "Northwestern University Libraries Digital Collections",
    );
    expect(body.summary.none[0]).toEqual(
      "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials.",
    );
    expect(body.items.length).toEqual(69);
    expect(body.items[0].type).toEqual("Collection");
  });
});

describe("IIIF Collection with navPlace aggregation", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  let pager: Paginator;

  beforeEach(() => {
    pager = new Paginator(
      "http://dcapi.library.northwestern.edu/api/v2/",
      "search",
      ["works"],
      { query: { query_string: { query: "test" } } },
      "iiif",
      {
        includeToken: false,
        queryStringParameters: {
          collectionLabel: "Test Collection with NavPlace",
          collectionSummary: "Collection containing works with geographic data",
          query: "test",
        },
      },
    );
  });

  it("aggregates navPlace from multiple works", async () => {
    const response = {
      status: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with NavPlace 1",
                nav_place: [
                  {
                    id: "https://sws.geonames.org/1275004/",
                    label: "Calcutta",
                    summary: "British survey depot",
                    coordinates: [88.3639, 22.5726],
                  },
                ],
              },
            },
            {
              _source: {
                id: "work-2",
                title: "Work with NavPlace 2",
                navPlace: [
                  {
                    id: "https://sws.geonames.org/2110435/",
                    label: "Ewa District",
                    summary: "Ewa District, Nauru",
                    coordinates: [166.93453, -0.5033],
                  },
                ],
              },
            },
          ],
        },
      }),
    };

    const result = await transform(response, pager);
    expect(result.status).toEqual(200);

    const body = await result.json();
    expect(body.navPlace).toBeDefined();
    expect(body.navPlace.type).toEqual("FeatureCollection");
    expect(body.navPlace.features.length).toEqual(2);
    expect(body.navPlace.features[0].geometry.type).toEqual("Point");
    expect(body.navPlace.features[0].geometry.coordinates).toEqual([
      88.3639, 22.5726,
    ]);
    expect(body.navPlace.features[1].geometry.coordinates).toEqual([
      166.93453, -0.5033,
    ]);
  });

  it("filters out non-Point geometries from navPlace", async () => {
    const response = {
      status: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with mixed geometries",
                nav_place: [
                  {
                    label: "Calcutta",
                    coordinates: [88.3639, 22.5726],
                  },
                  {
                    label: "Ignored entry",
                    coordinates: [0],
                  },
                ],
              },
            },
          ],
        },
      }),
    };

    const result = await transform(response, pager);
    const body = await result.json();

    expect(body.navPlace.features.length).toEqual(1);
    expect(body.navPlace.features[0].geometry.type).toEqual("Point");
  });

  it("omits navPlace when no works have navPlace data", async () => {
    const response = {
      status: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work without NavPlace",
              },
            },
          ],
        },
      }),
    };

    const result = await transform(response, pager);
    const body = await result.json();

    expect(body.navPlace).toEqual(undefined);
  });

  it("omits navPlace when all features are filtered out", async () => {
    const response = {
      status: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with only polygon",
                nav_place: [
                  {
                    label: "Invalid entry",
                    coordinates: [0],
                  },
                ],
              },
            },
          ],
        },
      }),
    };

    const result = await transform(response, pager);
    const body = await result.json();

    expect(body.navPlace).toEqual(undefined);
  });
});
