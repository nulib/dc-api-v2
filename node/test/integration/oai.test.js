"use strict";

const chai = require("chai");
const expect = chai.expect;
const convert = require("xml-js");
chai.use(require("chai-http"));

const { handler } = requireSource("handlers/oai");

const xmlOpts = {
  compact: true,
  alwaysChildren: true,
  alwaysArray: ["headers"],
};

describe("Oai routes", () => {
  helpers.saveEnvironment();
  const mock = helpers.mockIndex();

  describe("POST /oai", () => {
    it("supports the GetRecord verb", async () => {
      const body = "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc";
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(200, helpers.testFixture("mocks/work-1234.json"));
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);

      const resultBody = convert.xml2js(result.body, xmlOpts);
      const header = resultBody["OAI-PMH"].GetRecord.record.header;
      expect(header)
        .to.be.an("object")
        .and.to.deep.include.keys("identifier", "datestamp", "setSpec");
      const metadata =
        resultBody["OAI-PMH"].GetRecord.record.metadata["oai_dc:dc"];
      expect(metadata)
        .to.be.an("object")
        .and.to.deep.include.keys(
          "dc:contributor",
          "dc:creator",
          "dc:date",
          "dc:description",
          "dc:format",
          "dc:identifier",
          "dc:language",
          "dc:publisher",
          "dc:relation",
          "dc:rights",
          "dc:source",
          "dc:subject",
          "dc:title",
          "dc:type"
        );
    });

    it("enforces the id parameter for the GetRecord verb", async () => {
      const body = "verb=GetRecord&metadataPrefix=oai_dc";
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);

      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badArgument"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "You must supply an identifier for GetRecord requests"
      );
    });

    it("provides the correct error code when GetRecord does not find a matching work", async () => {
      const body = "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc";
      mock
        .get("/dc-v2-work/_doc/1234")
        .reply(404, helpers.testFixture("mocks/missing-work-1234.json"));
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(404);
      expect(result).to.have.header("content-type", /application\/xml/);

      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "idDoesNotExist"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "The specified record does not exist"
      );
    });

    it("supports the ListRecords verb", async () => {
      const body = "verb=ListRecords&metadataPrefix=oai_dc";
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(200, helpers.testFixture("mocks/scroll.json"));
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].ListRecords.record)
        .to.be.an("array")
        .and.to.have.lengthOf(12);
    });

    it("validates 'from' and 'until' parameters", async () => {
      const body =
        "verb=ListRecords&metadataPrefix=oai_dc&from=INVALID_DATE&until=INVALID_DATE";
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badArgument"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "Invalid date -- make sure that 'from' or 'until' parameters are formatted as: 'YYYY-MM-DDThh:mm:ss.ffffffZ'"
      );
    });

    it("supports 'from' and 'until' parameters in ListRecords and ListIdentifiers verbs", async () => {
      const body =
        "verb=ListRecords&metadataPrefix=oai_dc&from=2022-11-22T06:16:13.791570Z&until=2022-11-22T06:16:13.791572Z";
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(200, helpers.testFixture("mocks/scroll.json"));
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].ListRecords.record)
        .to.be.an("array")
        .and.to.have.lengthOf(12);
    });

    it("uses an empty resumptionToken to tell harvesters that list requests are complete", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(200, helpers.testFixture("mocks/scroll-empty.json"));

      mock
        .delete(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(200, {});

      const body =
        "verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB";
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      const resumptionToken = resultBody["OAI-PMH"].ListRecords.resumptionToken;
      expect(resumptionToken).to.not.haveOwnProperty("_text");
    });

    it("returns a badResumptionToken error when a resumptionToken expires", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(404, helpers.testFixture("mocks/scroll-missing.json"));

      const body =
        "verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB";
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(401);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badResumptionToken"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "Your resumptionToken is no longer valid"
      );
    });

    it("fails gracefully", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(404, helpers.testFixture("mocks/missing-index.json"));

      const body =
        "verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB";
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badRequest"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "An error occurred processing the ListRecords request"
      );
    });

    it("requires a metadataPrefix", async () => {
      const body = "verb=ListRecords";
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(200, helpers.testFixture("mocks/scroll.json"));
      const event = helpers.mockEvent("POST", "/oai").body(body).render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badArgument"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "Missing required metadataPrefix argument"
      );
    });

    it("supports the ListMetadataFormats verb", async () => {
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListMetadataFormats", metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      const listMetadataFormatsElement =
        resultBody["OAI-PMH"].ListMetadataFormats.metadataFormat;
      expect(listMetadataFormatsElement.metadataNamespace._text).to.eq(
        "http://www.openarchives.org/OAI/2.0/oai_dc/"
      );
    });
  });

  describe("GET /oai", () => {
    it("requires a verb", async () => {
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error._attributes).to.include({
        code: "badArgument",
      });
      expect(resultBody["OAI-PMH"].error._text).to.eq("Missing required verb");
    });

    it("supports the Identify verb", async () => {
      const query = {
        size: 1,
        _source: "create_date",
        query: {
          bool: {
            must: [
              { term: { api_model: "Work" } },
              { term: { published: true } },
              { term: { visibility: "Public" } },
            ],
          },
        },
        sort: [{ create_date: "asc" }],
      };
      mock
        .post("/dc-v2-work/_search", query)
        .reply(200, helpers.testFixture("mocks/search-earliest-record.json"));
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "Identify", metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      const identifyElement = resultBody["OAI-PMH"].Identify;
      expect(identifyElement.earliestDatestamp._text).to.eq(
        "2022-11-22T20:36:00.581418Z"
      );
      expect(identifyElement.deletedRecord._text).to.eq("no");
      expect(identifyElement.granularity._text).to.eq("YYYY-MM-DDThh:mm:ssZ");
    });

    it("supports the ListRecords verb", async () => {
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(200, helpers.testFixture("mocks/scroll.json"));
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListRecords", metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].ListRecords.record)
        .to.be.an("array")
        .to.have.lengthOf(12);
    });

    it("supports the ListSets verb", async () => {
      mock
        .post("/dc-v2-collection/_search")
        .reply(200, helpers.testFixture("mocks/oai-sets.json"));
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListSets" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].ListSets.set)
        .to.be.an("array")
        .and.to.have.lengthOf(3);
    });

    it("handles ListSets errors", async () => {
      mock
        .post("/dc-v2-collection/_search")
        .reply(500, helpers.testFixture("mocks/oai-sets.json"));
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListSets" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(500);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error._attributes).to.include({
        code: "badRequest",
      });
      expect(resultBody["OAI-PMH"].error._text).to.eq(
        "An error occurred processing the ListSets request"
      );
    });

    it("supports the ListIdentifiers verb", async () => {
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(200, helpers.testFixture("mocks/scroll.json"));
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListIdentifiers", metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(resumptionToken["_text"]).to.have.lengthOf(120);
    });

    it("requires a metadataPrefix for the ListIdentifiers verb", async () => {
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "ListIdentifiers" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error._attributes).to.include({
        code: "badArgument",
      });
      expect(resultBody["OAI-PMH"].error._text).to.eq(
        "Missing required metadataPrefix argument"
      );
    });

    it("supports the 'set' parameter", async () => {
      mock
        .post("/dc-v2-work/_search?scroll=2m")
        .reply(
          200,
          helpers.testFixture("mocks/oai-list-identifiers-sets.json")
        );
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          set: "c4f30015-88b5-4291-b3a6-8ac9b7c7069c",
        })
        .render();

      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].ListIdentifiers.header)
        .to.be.an("object")
        .to.have.keys(["identifier", "datestamp", "setSpec"]);
    });

    it("uses an empty resumptionToken to tell harvesters that list requests are complete", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(200, helpers.testFixture("mocks/scroll-empty.json"));

      mock
        .delete(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(200, {});

      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken:
            "FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB",
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(200);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(resumptionToken).to.not.haveOwnProperty("_text");
    });

    it("returns a badResumptionToken error when a resumptionToken expires", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(404, helpers.testFixture("mocks/scroll-missing.json"));

      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken:
            "FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB",
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(401);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badResumptionToken"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "Your resumptionToken is no longer valid"
      );
    });

    it("fails gracefully", async () => {
      mock
        .post(
          "/_search/scroll/FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB"
        )
        .reply(404, helpers.testFixture("mocks/missing-index.json"));

      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken:
            "FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB",
        })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).to.eq(
        "badRequest"
      );
      expect(resultBody["OAI-PMH"].error["_text"]).to.eq(
        "An error occurred processing the ListIdentifiers request"
      );
    });

    it("provides an error when an incorrect verb is submitted", async () => {
      const event = helpers
        .mockEvent("GET", "/oai")
        .queryParams({ verb: "BadVerb", metadataPrefix: "oai_dc" })
        .render();
      const result = await handler(event);
      expect(result.statusCode).to.eq(400);
      expect(result).to.have.header("content-type", /application\/xml/);
      const resultBody = convert.xml2js(result.body, xmlOpts);
      expect(resultBody["OAI-PMH"].error._attributes).to.include({
        code: "badVerb",
      });
    });
  });
});
