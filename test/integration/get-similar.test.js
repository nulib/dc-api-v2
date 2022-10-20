"use strict";

const chai = require("chai");
const expect = chai.expect;
const { handler } = require("../../src/handlers/get-similar");
const RequestPipeline = require("../../src/api/request/pipeline");
chai.use(require("chai-http"));

describe("Similar routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();
  let baseEvent = helpers
    .mockEvent("GET", "/works/{id}/similar")
    .pathPrefix("/api/v2")
    .pathParams({ id: 1234 });
  const makeQuery = (params) =>
    new RequestPipeline(params).authFilter().toJson();

  it("paginates results using default size and page number", async () => {
    mock
      .post(
        "/dc-v2-work/_search",
        makeQuery({
          query: {
            more_like_this: {
              fields: [
                "title",
                "description",
                "subject.label",
                "genre.label",
                "contributor.label",
                "creator.label",
              ],
              like: [
                {
                  _index: "dc-v2-work",
                  _id: 1234,
                },
              ],
              max_query_terms: 10,
              min_doc_freq: 1,
              min_term_freq: 1,
            },
          },
        })
      )
      .reply(200, helpers.testFixture("mocks/similar.json"));
    const event = baseEvent.render();
    const result = await handler(event);
    expect(result.statusCode).to.eq(200);
    expect(result).to.have.header(
      "content-type",
      /application\/json;.*charset=UTF-8/
    );
    const {
      pagination: { query_url },
    } = JSON.parse(result.body);
    const url = new URL(query_url);
    expect(url.searchParams.has("searchToken")).to.be.false;
    expect(url.searchParams.has("size")).to.be.false;
  });

  it("paginates results using provided size and page number", async () => {
    let mocked = mock
      .post(
        "/dc-v2-work/_search",
        makeQuery({
          query: {
            more_like_this: {
              fields: [
                "title",
                "description",
                "subject.label",
                "genre.label",
                "contributor.label",
                "creator.label",
              ],
              like: [
                {
                  _index: "dc-v2-work",
                  _id: 1234,
                },
              ],
              max_query_terms: 10,
              min_doc_freq: 1,
              min_term_freq: 1,
            },
          },
          size: 3,
          from: 6,
        })
      )
      .reply(200, helpers.testFixture("mocks/similar.json"));
    const event = baseEvent.queryParams({ page: 3, size: 3 }).render();
    const result = await handler(event);
    expect(result.statusCode).to.eq(200);
    expect(result).to.have.header(
      "content-type",
      /application\/json;.*charset=UTF-8/
    );
    const resultBody = JSON.parse(result.body);
    expect(resultBody.pagination.current_page).to.eq(3);
    expect(resultBody.pagination.limit).to.eq(3);
    expect(resultBody.pagination.offset).to.eq(6);
    expect(resultBody.pagination.total_hits).to.eq(9);
    expect(resultBody.pagination.total_pages).to.eq(3);
    const url = new URL(resultBody.pagination.query_url);
    expect(url.searchParams.has("searchToken")).to.be.false;
    expect(url.searchParams.get("size")).to.eq("3");
  });
});
