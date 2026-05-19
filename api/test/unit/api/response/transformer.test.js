"use strict";

const chai = require("chai");
const expect = chai.expect;

const transformer = requireSource("api/response/transformer");
const { Paginator } = requireSource("api/pagination");

describe("Response transformer", () => {
  helpers.saveEnvironment();

  describe("collapse responses", () => {
    let requestBody;
    let response;

    beforeEach(() => {
      response = {
        statusCode: 200,
        body: helpers.testFixture("mocks/collapse-search.json"),
      };

      requestBody = {
        query: {
          bool: {
            must: [
              { term: { "annotations.type": "transcription" } },
              { match_phrase: { "annotations.content": "coffee" } },
            ],
          },
        },
        size: 1,
        collapse: {
          field: "work_id",
          inner_hits: {
            name: "matching_filesets",
            size: 50,
            sort: [{ _score: "desc" }],
          },
        },
      };
    });

    it("transforms a `collapse` response to opensearch format", async () => {
      const pager = new Paginator(
        "http://dcapi.library.northwestern.edu/v2/",
        "search",
        ["file-sets"],
        requestBody
      );

      const result = await transformer.transformSearchResult(response, pager);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.data).to.be.an("array");
      expect(body.data.length).to.eq(4);
      expect(body.info).to.include.key("version");
      expect(body).to.include.key("pagination");
      expect(body.pagination.collapsed_by).to.deep.eq({
        field: "work_id",
        total_hits: 4,
      });
      expect(body.pagination.total_hits).to.eq(7);
      expect(body.pagination.total_pages).to.eq(4);
    });

    it("transforms a `collapse` response to iiif format", async () => {
      const pager = new Paginator(
        "http://dcapi.library.northwestern.edu/v2/",
        "search",
        ["file-sets"],
        requestBody,
        "iiif",
        {
          queryStringParameters: {
            collectionLabel: "Test Collection",
            collectionSummary: "Test Summary",
          },
        }
      );

      const result = await transformer.transformSearchResult(response, pager);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);

      expect(body.items).to.be.an("array");
      expect(body.items.length).to.eq(5);
      for (var i = 0; i <= 3; i++) {
        const item = body.items[i];
        expect(item).to.include.keys(
          "homepage",
          "label",
          "summary",
          "thumbnail",
          "type"
        );
        expect(item.type).to.eq("Manifest");
      }

      const item = body.items[4];
      expect(item).to.include.key("id");
      expect(item).to.include.key("type");
      expect(item.type).to.eq("Collection");
      expect(item.label?.none?.[0]).to.eq("Next page");
    });
  });
});
