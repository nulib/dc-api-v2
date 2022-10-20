"use strict";

const transformer = require("../../../../../src/api/response/iiif/collection");
const { Paginator } = require("../../../../../src/api/pagination");
const chai = require("chai");
const expect = chai.expect;

describe("IIIF Collection response transformer", () => {
  let pager;
  beforeEach(() => {
    pager = new Paginator(
      "http://dcapi.library.northwestern.edu/v2/",
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
});
