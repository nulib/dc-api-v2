"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));

const ApiToken = requireSource("api/api-token");

describe("Retrieve work by id", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("GET /works/{id}", () => {
    const { handler } = requireSource("handlers/get-work-by-id");

    it("retrieves a single work document", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/work/{id}")
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

    it("404s a missing work", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/missing-work-1234.json"));

      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathParams({ id: 1234 })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
    });

    it("returns a single work as a IIIF Manifest", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));

      // Minimal transcription fetch for Access file sets in the fixture
      mock
        .get("/dc-v2-file-set/_doc/076dcbd8-8c57-40e8-bdf7-dc9153c87a36")
        .reply(200, {
          _source: {
            id: "076dcbd8-8c57-40e8-bdf7-dc9153c87a36",
            annotations: [],
          },
        });
      mock
        .get("/dc-v2-file-set/_doc/51862c1c-c024-45dc-ab26-694bd8ebc16c")
        .reply(200, {
          _source: {
            id: "51862c1c-c024-45dc-ab26-694bd8ebc16c",
            annotations: [],
          },
        });

      const event = helpers
        .mockEvent("GET", "/works/{id}")
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
      expect(resultBody.type).to.eq("Manifest");
      expect(resultBody["@context"]).to.eq(
        "http://iiif.io/api/presentation/3/context.json"
      );
      expect(resultBody.label.none[0]).to.eq("Canary Record TEST 1");
    });

    it("will retrieve a private, unpublished work document with an entitlement", async () => {
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(
          200,
          helpers.testFixture("mocks/private-unpublished-work-1234.json")
        );

      const token = new ApiToken().addEntitlement("1234").sign();

      const event = helpers
        .mockEvent("GET", "/work/{id}")
        .pathParams({ id: "1234" })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token};`,
        })
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
  });
});
