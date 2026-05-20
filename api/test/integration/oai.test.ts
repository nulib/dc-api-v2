import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "bun:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as xmlJs from "xml-js";
import {
  TEST_OPENSEARCH_HOST,
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  testFixture,
} from "../test-helpers/index.ts";

const SCROLL_TOKEN =
  "FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFm1jN3ZCajdnUURpbUhad1hIYnNsQmcAAAAAAAB2DhZXbmtMZVF5Q1JsMi1ScGRsYUlHLUtB";

const xmlOpts = {
  compact: true,
  alwaysChildren: true,
  alwaysArray: ["headers"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseXml(text: string): any {
  return xmlJs.xml2js(text, xmlOpts);
}

describe("Oai routes", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  describe("POST /oai", () => {
    it("supports the GetRecord verb", async () => {
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const header = resultBody["OAI-PMH"].GetRecord.record.header;
      expect(typeof header === "object").toBe(true);
      expect("identifier" in header).toBe(true);
      expect("datestamp" in header).toBe(true);
      expect("setSpec" in header).toBe(true);

      const metadata =
        resultBody["OAI-PMH"].GetRecord.record.metadata["oai_dc:dc"];
      expect(typeof metadata === "object").toBe(true);
      expect("dc:contributor" in metadata).toBe(true);
      expect("dc:creator" in metadata).toBe(true);
      expect("dc:date" in metadata).toBe(true);
      expect("dc:description" in metadata).toBe(true);
      expect("dc:format" in metadata).toBe(true);
      expect("dc:identifier" in metadata).toBe(true);
      expect("dc:language" in metadata).toBe(true);
      expect("dc:publisher" in metadata).toBe(true);
      expect("dc:relation" in metadata).toBe(true);
      expect("dc:rights" in metadata).toBe(true);
      expect("dc:source" in metadata).toBe(true);
      expect("dc:subject" in metadata).toBe(true);
      expect("dc:title" in metadata).toBe(true);
      expect("dc:type" in metadata).toBe(true);
    });

    it("properly extracts values from complex fields for GetRecord", async () => {
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const metadata =
        resultBody["OAI-PMH"].GetRecord.record.metadata["oai_dc:dc"];

      // Verify subject uses label_with_role
      expect(Array.isArray(metadata["dc:subject"])).toBe(true);
      const subjectValues = metadata["dc:subject"].map(
        (s: { _text: string }) => s._text,
      );
      expect(subjectValues.includes("Cats on postage stamps (Topical)")).toBe(
        true,
      );

      // Verify contributor uses label_with_role
      expect(Array.isArray(metadata["dc:contributor"])).toBe(true);
      const contributorValues = metadata["dc:contributor"].map(
        (c: { _text: string }) => c._text,
      );
      expect(contributorValues[0].includes("Metallica (Musical group)")).toBe(
        true,
      );

      // Verify creator uses label
      expect(Array.isArray(metadata["dc:creator"])).toBe(true);
      const creatorValues = metadata["dc:creator"].map(
        (c: { _text: string }) => c._text,
      );
      expect(creatorValues[0].includes("Dessa")).toBe(true);

      // Verify language contains full URI
      const languageData = Array.isArray(metadata["dc:language"])
        ? metadata["dc:language"]
        : [metadata["dc:language"]];
      const languageValues = languageData.map(
        (l: { _text: string }) => l._text,
      );
      expect(
        languageValues.includes("http://id.loc.gov/vocabulary/languages/crh"),
      ).toBe(true);
      for (const lang of languageValues) {
        expect(lang.includes("http://")).toBe(true);
      }

      // Verify rights contains label
      expect(metadata["dc:rights"]._text.includes("Copyright")).toBe(true);
    });

    it("enforces the id parameter for the GetRecord verb", async () => {
      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badArgument",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "You must supply an identifier for GetRecord requests",
      );
    });

    it("provides the correct error code when GetRecord does not find a matching work", async () => {
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/missing-work-1234.json")),
            { status: 404 },
          ),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(404);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "idDoesNotExist",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "The specified record does not exist",
      );
    });

    it("supports the ListRecords verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);

      const firstRecord =
        resultBody["OAI-PMH"].ListRecords.record[0].header.datestamp._text;
      expect(firstRecord).toEqual("2022-11-22T20:36:00Z");
    });

    it("validates 'from' and 'until' parameters", async () => {
      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc&from=INVALID_DATE&until=INVALID_DATE",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badArgument",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "Invalid date -- make sure that 'from' or 'until' parameters are formatted as: 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm:ssZ'",
      );
    });

    it("supports 'from' and 'until' parameters in ListRecords and ListIdentifiers verbs", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc&from=2022-11-22T06:16:13Z&until=2022-11-22T06:16:15Z",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);
    });

    it("accepts OAI-PMH standard date formats without fractional seconds (Primo compatibility)", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc&from=1970-01-02T00:00:00Z",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);
    });

    it("accepts OAI-PMH date-only format (YYYY-MM-DD)", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc&from=2022-01-01&until=2022-12-31",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);
    });

    it("rejects OAI-PMH dates that include fractional seconds", async () => {
      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=oai_dc&from=2022-11-22T06:16:13.7Z&until=2022-11-22T06:16:13.79157Z",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "badArgument",
      );
    });

    it("uses an empty resumptionToken to tell harvesters that list requests are complete", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/scroll-empty.json")),
            ),
        ),
        http.delete(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () => HttpResponse.json({}),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const resumptionToken = resultBody["OAI-PMH"].ListRecords.resumptionToken;
      expect(!("_text" in resumptionToken)).toBe(true);
    });

    it("allows resumptionToken without metadataPrefix for ListRecords", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () => HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&resumptionToken=${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);
    });

    it("returns a badResumptionToken error when a resumptionToken expires", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/scroll-missing.json")),
              { status: 404 },
            ),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(401);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badResumptionToken",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "Your resumptionToken is no longer valid",
      );
    });

    it("fails gracefully", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-index.json")),
              { status: 404 },
            ),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&metadataPrefix=oai_dc&resumptionToken=${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badRequest",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "An error occurred processing the ListRecords request",
      );
    });

    it("requires a metadataPrefix", async () => {
      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badArgument",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "Missing required metadataPrefix argument",
      );
    });

    it("supports the ListMetadataFormats verb", async () => {
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListMetadataFormats", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const listMetadataFormatsElement =
        resultBody["OAI-PMH"].ListMetadataFormats.metadataFormat;
      expect(listMetadataFormatsElement.metadataNamespace._text).toEqual(
        "http://www.openarchives.org/OAI/2.0/oai_dc/",
      );
    });
  });

  describe("GET /oai", () => {
    it("requires a verb", async () => {
      const req = buildRequest("GET", "/oai", {
        queryParams: { metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "badArgument",
      );
      expect(resultBody["OAI-PMH"].error._text).toEqual(
        "Missing required verb",
      );
    });

    it("supports the Identify verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/search-earliest-record.json")),
          ),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "Identify", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const identifyElement = resultBody["OAI-PMH"].Identify;
      expect(identifyElement.earliestDatestamp._text).toEqual(
        "2022-11-22T20:36:00Z",
      );
      expect(identifyElement.deletedRecord._text).toEqual("no");
      expect(identifyElement.granularity._text).toEqual("YYYY-MM-DDThh:mm:ssZ");
    });

    it("supports the ListRecords verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListRecords", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListRecords.record.length).toEqual(12);
    });

    it("supports the ListSets verb", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/dc-v2-collection/_search`,
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/oai-sets.json"))),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListSets" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].ListSets.set.length).toEqual(3);
    });

    it("handles ListSets errors", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/dc-v2-collection/_search`,
          () =>
            HttpResponse.json(JSON.parse(testFixture("mocks/oai-sets.json")), {
              status: 500,
            }),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListSets" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(500);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "badRequest",
      );
      expect(resultBody["OAI-PMH"].error._text).toEqual(
        "An error occurred processing the ListSets request",
      );
    });

    it("supports the ListIdentifiers verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListIdentifiers", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(resumptionToken["_text"].length).toEqual(120);
    });

    it("requires a metadataPrefix for the ListIdentifiers verb", async () => {
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListIdentifiers" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "badArgument",
      );
      expect(resultBody["OAI-PMH"].error._text).toEqual(
        "Missing required metadataPrefix argument",
      );
    });

    it("supports the 'set' parameter", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(
            JSON.parse(testFixture("mocks/oai-list-identifiers-sets.json")),
          ),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: {
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          set: "c4f30015-88b5-4291-b3a6-8ac9b7c7069c",
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const headerEl = resultBody["OAI-PMH"].ListIdentifiers.header;
      expect(typeof headerEl === "object").toBe(true);
      expect("identifier" in headerEl).toBe(true);
      expect("datestamp" in headerEl).toBe(true);
      expect("setSpec" in headerEl).toBe(true);
    });

    it("uses an empty resumptionToken to tell harvesters that list requests are complete (GET)", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/scroll-empty.json")),
            ),
        ),
        http.delete(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () => HttpResponse.json({}),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: {
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken: SCROLL_TOKEN,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(!("_text" in resumptionToken)).toBe(true);
    });

    it("allows resumptionToken without metadataPrefix for ListIdentifiers", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () => HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: {
          verb: "ListIdentifiers",
          resumptionToken: SCROLL_TOKEN,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(resumptionToken["_text"].length).toEqual(120);
    });

    it("returns a badResumptionToken error when a resumptionToken expires (GET)", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/scroll-missing.json")),
              { status: 404 },
            ),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: {
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken: SCROLL_TOKEN,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(401);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badResumptionToken",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "Your resumptionToken is no longer valid",
      );
    });

    it("fails gracefully (GET)", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () =>
            HttpResponse.json(
              JSON.parse(testFixture("mocks/missing-index.json")),
              { status: 404 },
            ),
        ),
      );

      const req = buildRequest("GET", "/oai", {
        queryParams: {
          verb: "ListIdentifiers",
          metadataPrefix: "oai_dc",
          resumptionToken: SCROLL_TOKEN,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error["_attributes"]["code"]).toEqual(
        "badRequest",
      );
      expect(resultBody["OAI-PMH"].error["_text"]).toEqual(
        "An error occurred processing the ListIdentifiers request",
      );
    });

    it("provides an error when an incorrect verb is submitted", async () => {
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "BadVerb", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual("badVerb");
    });
  });
});
