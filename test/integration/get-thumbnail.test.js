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
    .pathParams({ id: 1234 })
    .render();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abcdef";
  });

  it("retrieves a thumbnail", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));
    mock
      .get("/iiif/2/thumbnail/test")
      .reply(200, helpers.testFixture("mocks/thumbnail.jpg"), {
        "Content-Type": "image/jpeg",
      });

    const result = await handler(event);
    expect(result.statusCode).to.eq(200);
    expect(result.headers["content-type"]).to.eq("image/jpeg");
  });

  it("returns an error from the IIIF server", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234.json"));
    mock
      .get("/iiif/2/thumbnail/test")
      .reply(403, "Forbidden", { "Content-Type": "text/plain" });

    const result = await handler(event);
    expect(result.statusCode).to.eq(403);
    expect(result.body).to.eq("Forbidden");
  });

  it("returns 404 if the work doc can't be found", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

    const result = await handler(event);
    expect(result.statusCode).to.eq(404);
  });

  it("returns 404 if the work doc has no thumbnail", async () => {
    mock
      .get("/dc-v2-work/_doc/1234")
      .reply(200, helpers.testFixture("mocks/work-1234-no-thumbnail.json"));

    const result = await handler(event);
    expect(result.statusCode).to.eq(404);
  });
});
