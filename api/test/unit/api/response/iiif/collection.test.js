"use strict";

const chai = require("chai");
const expect = chai.expect;

const transformer = requireSource("api/response/iiif/collection");
const { Paginator } = requireSource("api/pagination");

describe("IIIF Collection response transformer", () => {
  helpers.saveEnvironment();

  let pager;
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
      }
    );
  });

  it("transforms a search response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/search.json"),
    };
    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.type).to.eq("Collection");
    expect(body.label.none[0]).to.eq("The collection label");
  });

  it("transforms an error response", async () => {
    const response = {
      statusCode: 404,
      body: helpers.testFixture("mocks/missing-index.json"),
    };

    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(404);

    const body = JSON.parse(result.body);
    expect(body.status).to.eq(404);
    expect(body.error).to.be.a("string");
  });

  it("handles a request including /similar route", async () => {
    let pagerWorkSimilar = new Paginator(
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
      }
    );

    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/search.json"),
    };
    const result = await transformer.transform(response, pagerWorkSimilar);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.homepage[0].id).to.contain("search?similar=1234");
  });
});

describe("IIIF Collection response for top level colllections", () => {
  helpers.saveEnvironment();

  let pager = new Paginator(
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
    }
  );

  pager.pageInfo.query_url =
    "http://dcapi.library.northwestern.edu/api/v2/collections?as=iiif";

  it("transform a collection of collections response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/collections.json"),
    };

    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.type).to.eq("Collection");
    expect(body.label.none[0]).to.eq(
      "Northwestern University Libraries Digital Collections"
    );
    expect(body.summary.none[0]).to.eq(
      "Explore digital resources from the Northwestern University Library collections – including letters, photographs, diaries, maps, and audiovisual materials."
    );
    expect(body.items.length).to.eq(69);
    expect(body.items[0].type).to.eq("Collection");
  });
});

describe("IIIF Collection with navPlace aggregation", () => {
  helpers.saveEnvironment();

  let pager;
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
      }
    );
  });

  it("aggregates navPlace from multiple works", async () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with NavPlace 1",
                nav_place: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      geometry: {
                        type: "Point",
                        coordinates: [88.3639, 22.5726],
                      },
                      properties: {
                        label: { en: ["Calcutta"] },
                        summary: { en: ["British survey depot"] },
                      },
                    },
                  ],
                },
              },
            },
            {
              _source: {
                id: "work-2",
                title: "Work with NavPlace 2",
                navPlace: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      geometry: {
                        type: "Point",
                        coordinates: [166.93453, -0.5033],
                      },
                      properties: {
                        label: { en: ["Ewa District"] },
                        summary: { en: ["Ewa District, Nauru"] },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    };

    const result = await transformer.transform(response, pager);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.navPlace).to.exist;
    expect(body.navPlace.type).to.eq("FeatureCollection");
    expect(body.navPlace.features).to.have.lengthOf(2);
    expect(body.navPlace.features[0].geometry.type).to.eq("Point");
    expect(body.navPlace.features[0].geometry.coordinates).to.deep.eq([
      88.3639, 22.5726,
    ]);
    expect(body.navPlace.features[1].geometry.coordinates).to.deep.eq([
      166.93453, -0.5033,
    ]);
  });

  it("filters out non-Point geometries from navPlace", async () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with mixed geometries",
                nav_place: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      geometry: {
                        type: "Point",
                        coordinates: [88.3639, 22.5726],
                      },
                      properties: {
                        label: { en: ["Calcutta"] },
                      },
                    },
                    {
                      type: "Feature",
                      geometry: {
                        type: "Polygon",
                        coordinates: [
                          [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 10],
                            [0, 0],
                          ],
                        ],
                      },
                      properties: {
                        label: { en: ["Ignored polygon"] },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    };

    const result = await transformer.transform(response, pager);
    const body = JSON.parse(result.body);

    expect(body.navPlace.features).to.have.lengthOf(1);
    expect(body.navPlace.features[0].geometry.type).to.eq("Point");
  });

  it("omits navPlace when no works have navPlace data", async () => {
    const response = {
      statusCode: 200,
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

    const result = await transformer.transform(response, pager);
    const body = JSON.parse(result.body);

    expect(body.navPlace).to.be.undefined;
  });

  it("omits navPlace when all features are filtered out", async () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                id: "work-1",
                title: "Work with only polygon",
                nav_place: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      geometry: {
                        type: "Polygon",
                        coordinates: [
                          [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 10],
                            [0, 0],
                          ],
                        ],
                      },
                      properties: {
                        label: { en: ["Polygon only"] },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    };

    const result = await transformer.transform(response, pager);
    const body = JSON.parse(result.body);

    expect(body.navPlace).to.be.undefined;
  });
});
