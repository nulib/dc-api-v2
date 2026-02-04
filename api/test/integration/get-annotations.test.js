"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

describe("Annotation routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /file-sets/{id}/annotations", () => {
    const { handler } = requireSource("handlers/get-file-set-annotations");

    it("returns annotations for a file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-annotated-1234.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/annotations")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.data).to.be.an("array").with.lengthOf(1);
      expect(body.data[0].type).to.eq("transcription");
    });

    it("returns IIIF annotation page with annotations", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-annotated-1234.json"));

      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, helpers.testFixture("mocks/work-file-sets-access.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/annotations")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.type).to.eq("AnnotationPage");
      expect(body.items).to.be.an("array").with.lengthOf(1);
      expect(body.items[0].type).to.eq("Annotation");
      expect(body.items[0].motivation).to.eq("commenting");
      expect(body.items[0].body.value).to.exist;
    });

    it("returns IIIF annotation page with empty items when no annotations", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-1234.json"));

      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, helpers.testFixture("mocks/work-file-sets-access.json"));

      const event = helpers
        .mockEvent("GET", "/file-sets/{id}/annotations")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.type).to.eq("AnnotationPage");
      expect(body.items).to.be.an("array").with.lengthOf(0);
    });
  });

  describe("GET /annotations/{id}", () => {
    const { handler } = requireSource("handlers/get-annotation-by-id");

    it("returns a single annotation", async () => {
      mock
        .post("/dc-v2-file-set/_search", () => true)
        .reply(200, helpers.testFixture("mocks/annotation-search-hit.json"));

      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-annotated-1234.json"));

      const event = helpers
        .mockEvent("GET", "/annotations/{id}")
        .pathParams({ id: "36a47020-5410-4dda-a7ca-967fe3885bcd" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);

      const body = JSON.parse(result.body);
      expect(body.data.id).to.eq("36a47020-5410-4dda-a7ca-967fe3885bcd");
    });
  });
});
