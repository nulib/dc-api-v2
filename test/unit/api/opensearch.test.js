"use strict";

const opensearch = require("../../../src/api/opensearch");
const chai = require("chai");
const expect = chai.expect;

describe("getWork()", function () {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  it("gets a work by its id", async function () {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(200);
    expect(body._source.api_model).to.eq("Work");
  });

  it("returns 404 Not Found for unpublished works", async function () {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/unpublished-work-1234.json"));

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(404);
    expect(body.found).to.be.false;
  });

  it("returns 404 Not Found for missing documents", async function () {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(404, helpers.testFixture("mocks/missing-work-1234.json"));

    const result = await opensearch.getWork("1234");
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(404);
    expect(body.found).to.be.false;
  });
});

describe("getFileSet()", function () {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  it("gets a fileset by its id", async function () {
    mock
      .get("/dc-v2-file-set/_doc/1234")
      .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

    const result = await opensearch.getFileSet("1234");
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(200);
    expect(body._source.api_model).to.eq("FileSet");
  });
});

describe("getCollection()", function () {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  it("gets a collection by its id", async function () {
    mock
      .get("/dc-v2-collection/_doc/1234")
      .reply(200, helpers.testFixture("mocks/collection-1234.json"));

    const result = await opensearch.getCollection("1234");
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(200);
    expect(body._source.api_model).to.eq("Collection");
  });
});

describe("search()", function () {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  it("performs searches", async function () {
    mock
      .post("/dc-v2-work/_search", "{ query: { match_all: {} } }")
      .reply(200, helpers.testFixture("mocks/search.json"));

    const result = await opensearch.search(
      "dc-v2-work",
      "{ query: { match_all: {} } }"
    );
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(200);
    expect(body.hits.hits.length).to.eq(10);
    expect(body.hits.total.value).to.eq(4199);
  });

  it("can search multiple targets", async function () {
    mock
      .post(
        "/dc-v2-work,dc-v2-collection/_search",
        "{ query: { match_all: {} } }"
      )
      .reply(200, helpers.testFixture("mocks/search-multiple-targets.json"));

    const result = await opensearch.search(
      "dc-v2-work,dc-v2-collection",
      "{ query: { match_all: {} } }"
    );
    const body = JSON.parse(result.body);
    expect(result.statusCode).to.eq(200);
    expect(body.hits.hits.length).to.eq(10);
    expect(body.hits.total.value).to.eq(4331);
  });
});
