"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const ApiToken = requireSource("api/api-token");

// Matches the first Access file set (canvas/0) in mocks/work-1234.json
const annotatedFileSetsResponse = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _source: {
          id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
          group_with: null,
          annotations: [
            {
              id: "anno-uuid-1",
              type: "transcription",
              language: ["en"],
              content:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae nisl a leo faucibus consectetur.",
              model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
            },
          ],
        },
      },
    ],
  },
};

// Matches the second Access file set (canvas/1) in mocks/work-1234.json
const annotatedSecondFileSetsResponse = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _source: {
          id: "51862c1c-c024-45dc-ab26-694bd8ebc16c",
          group_with: null,
          annotations: [
            {
              id: "anno-uuid-2",
              type: "transcription",
              language: ["en"],
              content:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae nisl a leo faucibus consectetur.",
              model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
            },
          ],
        },
      },
    ],
  },
};

const emptyFileSetsResponse = {
  hits: {
    total: { value: 0 },
    hits: [],
  },
};

describe("IIIF Search 2.0 for a work", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /works/{id}/search", () => {
    const { handler } = requireSource("handlers/get-work-search");

    it("returns a IIIF Search 2.0 AnnotationPage with matching items", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, annotatedFileSetsResponse);

      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body["@context"]).to.eq(
        "http://iiif.io/api/search/2/context.json"
      );
      expect(body.type).to.eq("AnnotationPage");
      expect(body.id).to.include("?as=iiif&q=Lorem");
      expect(body.items).to.have.lengthOf(1);

      const item = body.items[0];
      expect(item.type).to.eq("Annotation");
      expect(item.motivation).to.eq("supplementing");
      expect(item.body.type).to.eq("TextualBody");
      expect(item.body.value).to.include("Lorem");
      expect(item.body.format).to.eq("text/plain");
      expect(item.body.language).to.eq("en");
      expect(item.target).to.include("/canvas/0");
    });

    it("uses the correct canvas index from the manifest ordering, not sequential search result order", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, annotatedSecondFileSetsResponse);

      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.items).to.have.lengthOf(1);
      // Second Access file set in work-1234.json must map to canvas/1, not canvas/0
      expect(body.items[0].target).to.include("/canvas/1");
    });

    it("returns an empty items array when no annotations match", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, annotatedFileSetsResponse);

      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "zzznomatch" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.type).to.eq("AnnotationPage");
      expect(body.items).to.deep.eq([]);
    });

    it("returns 400 when q parameter is missing", async () => {
      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
    });

    it("returns 400 when as parameter is not iiif", async () => {
      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
    });

    it("returns 404 when the work does not exist", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("returns 403 when the work is private and no token is provided", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });

    it("returns results for a private work with a valid entitlement token", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));
      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, emptyFileSetsResponse);

      const token = new ApiToken().addEntitlement("1234").sign();
      const event = helpers
        .mockEvent("GET", "/works/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .headers({ Cookie: `${process.env.API_TOKEN_NAME}=${token};` })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.type).to.eq("AnnotationPage");
    });
  });
});
