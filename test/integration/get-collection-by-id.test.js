"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const RequestPipeline = requireSource("api/request/pipeline");

describe("Retrieve collection by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /collections/{id}", () => {
    beforeEach(() => {
      process.env.READING_ROOM_IPS = "";
    });

    const { handler } = requireSource("handlers/get-collection-by-id");

    it("retrieves a single collection link document", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );

      const resultBody = JSON.parse(result.body);
      expect(resultBody.data.id).to.eq("1234");
    });

    it("404s a missing collection", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-collection-1234.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("404's if the collection is private", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/collection-1234-private-published.json")
        );

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("200's if the collection is private but the user is in the reading room", async () => {
      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/collection-1234-private-published.json")
        );

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .render();

      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
    });

    it("returns a single collection as a IIIF collection", async () => {
      const originalQuery = {
        query: { query_string: { query: "collection.id:1234" } },
      };
      const authQuery = new RequestPipeline(originalQuery)
        .authFilter(helpers.preprocess({}))
        .toJson();

      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(200, helpers.testFixture("mocks/collection-1234.json"));
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
      expect(resultBody.label.none[0]).to.eq("Collection Title");
    });

    it("redirects to /collections when id is missing or empty", async () => {
      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: "" })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(301);
      expect(result).to.have.header(
        "location",
        "https://api.test.library.northwestern.edu/api/v2/collections"
      );
    });

    it("returns a private IIIF collection if the user is in the reading room", async () => {
      const event = helpers
        .mockEvent("GET", "/collections/{id}")
        .pathParams({ id: 1234 })
        .queryParams({ as: "iiif" })
        .render();

      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      const originalQuery = {
        query: { query_string: { query: "collection.id:1234" } },
      };

      let preProcessedEvent = helpers.preprocess(event);

      const authQuery = new RequestPipeline(originalQuery)
        .authFilter(preProcessedEvent)
        .toJson();

      mock
        .get("/dc-v2-collection/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/collection-1234-private-published.json")
        );
      mock
        .post("/dc-v2-work/_search", authQuery)
        .reply(200, helpers.testFixture("mocks/search.json"));

      const result = await handler(preProcessedEvent);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header(
        "content-type",
        /application\/json;.*charset=UTF-8/
      );
      const resultBody = JSON.parse(result.body);
      expect(resultBody.type).to.eq("Collection");
      expect(resultBody.label.none[0]).to.eq("Collection Title");
    });
  });
});
