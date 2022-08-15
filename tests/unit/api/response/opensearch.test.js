"use strict";

const transformer = require("../../../../src/api/response/opensearch");
const chai = require("chai");
const expect = chai.expect;

describe("OpenSearch response transformer", () => {
  it("transforms a doc response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/work-1234.json"),
    };
    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.data).to.be.an("object");
  });

  it("transforms a search response", async () => {
    const response = {
      statusCode: 200,
      body: helpers.testFixture("mocks/search.json"),
    };
    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(200);

    const body = JSON.parse(result.body);
    expect(body.data).to.be.an("array");
  });

  it("transforms an error response", async () => {
    const response = {
      statusCode: 404,
      body: helpers.testFixture("mocks/missing-index.json"),
    };

    const result = await transformer.transform(response);
    expect(result.statusCode).to.eq(404);

    const body = JSON.parse(result.body);
    expect(body.status).to.eq(404);
    expect(body.error).to.be.a("string");
  });
});
