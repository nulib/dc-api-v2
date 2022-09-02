"use strict";

const chai = require("chai");
const expect = chai.expect;
const { handler } = require("../../src/handlers/get-work-thumbnail");

describe("Work thumbnail", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();
  const event = helpers
    .mockEvent("GET", "/works/{id}/thumbnail")
    .pathPrefix("/api/v2")
    .pathParams({ id: 1234 });

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abcdef";
  });

  it("retrieves a thumbnail", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));
    mock
      .get("/iiif/2/mbk-dev/5678/square/!300,300/0/default.jpg")
      .reply(200, helpers.testFixture("mocks/thumbnail_square.jpg"), {
        "Content-Type": "image/jpeg",
      });

    const result = await handler(event.render());
    expect(result.statusCode).to.eq(200);
    expect(result.headers["content-type"]).to.eq("image/jpeg");
  });

  it("returns an error from the IIIF server", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));
    mock
      .get("/iiif/2/mbk-dev/5678/square/!300,300/0/default.jpg")
      .reply(403, "Forbidden", { "Content-Type": "text/plain" });

    const result = await handler(event.render());
    expect(result.statusCode).to.eq(403);
    expect(result.body).to.eq("Forbidden");
  });

  it("returns 404 if the work doc can't be found", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

    const result = await handler(event.render());
    expect(result.statusCode).to.eq(404);
  });

  it("returns 404 if the work doc has no thumbnail", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234-no-thumbnail.json"));

    const result = await handler(event.render());
    expect(result.statusCode).to.eq(404);
  });

  it("accepts a proper size", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));
    mock
      .get("/iiif/2/mbk-dev/5678/square/!200,200/0/default.jpg")
      .reply(200, helpers.testFixture("mocks/thumbnail_square.jpg"), {
        "Content-Type": "image/jpeg",
      });

    const result = await handler(event.queryParams({ size: 200 }).render());
    expect(result.statusCode).to.eq(200);
  });

  it("rejects invalid sizes", async () => {
    let result = await handler(event.queryParams({ size: "foo" }).render());
    expect(result.statusCode).to.eq(400);
    expect(result.body).to.contain("foo is not");

    result = await handler(event.queryParams({ size: 500 }).render());
    expect(result.statusCode).to.eq(400);
    expect(result.body).to.contain("500px");
  });

  it("accepts proper aspect ratios", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .times(2)
      .reply(200, helpers.testFixture("mocks/work-1234.json"));

    let resultFixture = "mocks/thumbnail_full.jpg";
    mock
      .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
      .reply(200, helpers.testFixture(resultFixture), {
        "Content-Type": "image/jpeg",
      });

    let result = await handler(event.queryParams({ aspect: "full" }).render());
    expect(result.statusCode).to.eq(200);
    let expected = helpers.encodedFixture(resultFixture);
    expect(result.body).to.eq(expected);

    resultFixture = "mocks/thumbnail_square.jpg";
    mock
      .get("/iiif/2/mbk-dev/5678/square/!300,300/0/default.jpg")
      .reply(200, helpers.testFixture(resultFixture), {
        "Content-Type": "image/jpeg",
      });

    result = await handler(event.queryParams({ aspect: "square" }).render());
    expect(result.statusCode).to.eq(200);
    expected = helpers.encodedFixture(resultFixture);
    expect(result.body).to.eq(expected);
  });

  it("rejects improper aspect ratio", async () => {
    const result = await handler(event.queryParams({ aspect: "foo" }).render());
    expect(result.statusCode).to.eq(400);
    expect(result.body).to.contain("Unknown aspect ratio: foo");
  });
});