"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

describe("IIIF Search 2.0 for a file set", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /file-sets/{id}/search", () => {
    const { handler } = requireSource("handlers/get-file-set-search");

    it("returns a IIIF Search 2.0 AnnotationPage with matching items", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-annotated-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/search")
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
      expect(body.id).to.include("/file-sets/1234/search?as=iiif&q=Lorem");
      expect(body.items).to.have.lengthOf(1);

      const item = body.items[0];
      expect(item.id).to.eq(
        `${process.env.DC_API_ENDPOINT}/annotations/36a47020-5410-4dda-a7ca-967fe3885bcd?as=iiif`
      );
      expect(item.type).to.eq("Annotation");
      expect(item.motivation).to.eq("commenting");
      expect(item.body.type).to.eq("TextualBody");
      expect(item.body.value).to.include("Lorem");
      expect(item.body.format).to.eq("text/plain");
      expect(item.body.language).to.deep.eq(["lg", "en"]);
      expect(item.target).to.deep.eq({
        type: "SpecificResource",
        source: {
          id: `${process.env.DC_API_ENDPOINT}/file-sets/1234?as=iiif`,
          type: "Canvas",
          partOf: [
            {
              id: `${process.env.DC_API_ENDPOINT}/works/work-1234?as=iiif`,
              type: "Manifest",
            },
          ],
        },
      });
    });

    it("returns an empty items array when no annotations match", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-annotated-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/search")
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
        .mockEvent("GET", "/file-sets/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
    });

    it("returns 400 when as parameter is not iiif", async () => {
      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
    });

    it("returns 404 when the file set does not exist", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-fileset-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("returns 403 when the file set is private and no token is provided", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-restricted-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/search")
        .pathParams({ id: "1234" })
        .queryParams({ as: "iiif", q: "Lorem" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(403);
    });
  });
});
