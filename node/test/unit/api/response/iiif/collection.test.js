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
