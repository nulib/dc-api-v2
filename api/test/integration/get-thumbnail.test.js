"use strict";

const chai = require("chai");
const expect = chai.expect;

const ApiToken = requireSource("api/api-token");
const { handler } = requireSource("handlers/get-thumbnail");

function expectCorsHeaders(result) {
  expect(result.headers["Access-Control-Allow-Credentials"]).to.eq("true");
  expect(result.headers["Access-Control-Allow-Origin"]).to.eq(
    "https://test.example.edu/"
  );
}

describe("Thumbnail routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  beforeEach(() => {
    process.env.API_TOKEN_SECRET = "abcdef";
  });

  describe("Collection", () => {
    const event = helpers
      .mockEvent("GET", "/collections/{id}/thumbnail")
      .headers({ origin: "https://test.example.edu/" })
      .pathParams({ id: 1234 });

    it("retrieves a thumbnail", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
      expect(result.headers["content-type"]).to.eq("image/jpeg");
      expectCorsHeaders(result);
    });

    it("returns an error from the IIIF server", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(403, "Forbidden", { "Content-Type": "text/plain" });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(403);
      expect(result.body).to.eq("Forbidden");
      expectCorsHeaders(result);
    });

    it("returns 404 if the collection doc can't be found", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-collection-1234.json"));

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the collection doc has no representative work", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/collection-1234-no-thumbnail.json")
        );

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });
  });

  describe("Work", () => {
    const event = helpers
      .mockEvent("GET", "/works/{id}/thumbnail")
      .headers({ origin: "https://test.example.edu/" })
      .pathParams({ id: 1234 });

    it("retrieves a thumbnail", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
      expect(result.headers["content-type"]).to.eq("image/jpeg");
      expectCorsHeaders(result);
    });

    it("returns an error from the IIIF server", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(403, "Forbidden", { "Content-Type": "text/plain" });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(403);
      expect(result.body).to.eq("Forbidden");
      expectCorsHeaders(result);
    });

    it("returns 404 if the work doc can't be found", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the work doc has no thumbnail", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234-no-thumbnail.json"));

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 403 if the work is private", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(403);
    });

    it("returns 200 if the work is private and the user is in the reading room", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });
      const renderedEvent = event.render();

      process.env.READING_ROOM_IPS = renderedEvent.requestContext.http.sourceIp;
      const result = await handler(renderedEvent);
      expect(result.statusCode).to.eq(200);
    });

    it("returns 404 if the work is unpublished", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/unpublished-work-1234.json"));

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(404);
    });

    it("returns 200 if there is an entitlement for an unpublished, private work", async () => {
      const token = new ApiToken().addEntitlement("1234").sign();
      const event = helpers
        .mockEvent("GET", "/works/{id}/thumbnail")
        .pathParams({ id: "1234" })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        });

      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/private-unpublished-work-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());

      expect(result.statusCode).to.eq(200);
    });
  });

  describe("FileSet", () => {
    const event = helpers
      .mockEvent("GET", "/file-sets/{id}/thumbnail")
      .headers({ origin: "https://test.example.edu/" })
      .pathParams({ id: 1234 });

    it("retrieves a thumbnail for an Access image file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-image-access-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
      expect(result.headers["content-type"]).to.eq("image/jpeg");
      expectCorsHeaders(result);
    });

    it("retrieves a thumbnail for an Auxiliary image file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-image-auxiliary-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
      expectCorsHeaders(result);
    });

    it("returns 404 for a non-image (audio) file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-audio-1234.json"));

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 404 for a non-image (video) file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/fileset-video-1234.json"));

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 404 if the file set doc can't be found", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-fileset-1234.json"));

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 403 if the file set is private", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-private-image-1234.json")
        );

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(403);
      expectCorsHeaders(result);
    });

    it("returns 200 if the file set is private and the user is in the reading room", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-private-image-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const renderedEvent = event.render();
      process.env.READING_ROOM_IPS = renderedEvent.requestContext.http.sourceIp;
      const result = await handler(renderedEvent);
      expect(result.statusCode).to.eq(200);
    });

    it("returns 200 for an institution file set", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-institution-image-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
      expectCorsHeaders(result);
    });

    it("returns 404 if the file set is unpublished", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-unpublished-image-1234.json")
        );

      const result = await handler(event.render());
      expect(result.error.statusCode).to.eq(404);
      expectCorsHeaders(result);
    });

    it("returns 200 for an unpublished file set if the user is a superuser", async () => {
      const token = new ApiToken().superUser().sign();
      const superEvent = helpers
        .mockEvent("GET", "/file-sets/{id}/thumbnail")
        .headers({ authorization: `Bearer ${token}` })
        .pathParams({ id: 1234 });

      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-unpublished-image-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(superEvent.render());
      expect(result.statusCode).to.eq(200);
    });

    it("returns an error from the IIIF server", async () => {
      mock
        .get("/dc-v2-file-set/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/fileset-image-access-1234.json")
        );
      mock
        .get("/iiif/2/mbk-dev/1234/full/!300,300/0/default.jpg")
        .reply(403, "Forbidden", { "Content-Type": "text/plain" });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(403);
      expect(result.body).to.eq("Forbidden");
      expectCorsHeaders(result);
    });
  });

  describe("Superuser", () => {
    let event;

    beforeEach(() => {
      const token = new ApiToken().superUser().sign();
      event = helpers
        .mockEvent("GET", "/works/{id}/thumbnail")
        .headers({
          authorization: `Bearer ${token}`,
          origin: "https://test.example.edu/",
        })
        .pathParams({ id: 1234 });
    });

    it("retrieves thumbnail even if the work is private", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/private-work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
    });

    it("retrieves thumbnail even if the work is unpublished", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/unpublished-work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!300,300/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
          "Content-Type": "image/jpeg",
        });

      const result = await handler(event.render());
      expect(result.statusCode).to.eq(200);
    });
  });

  describe("QueryString parameters", () => {
    const event = helpers
      .mockEvent("GET", "/works/{id}/thumbnail")
      .pathParams({ id: 1234 });

    it("accepts a proper size", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      mock
        .get("/iiif/2/mbk-dev/5678/full/!200,200/0/default.jpg")
        .reply(200, helpers.testFixture("mocks/thumbnail_full.jpg"), {
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

      let result = await handler(
        event.queryParams({ aspect: "full" }).render()
      );
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
      const result = await handler(
        event.queryParams({ aspect: "foo" }).render()
      );
      expect(result.statusCode).to.eq(400);
      expect(result.body).to.contain("Unknown aspect ratio: foo");
    });
  });
});
