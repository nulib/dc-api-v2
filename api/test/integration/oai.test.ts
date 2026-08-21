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
import { formatOaiDate } from "../../src/handlers/oai/date-utils.ts";

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

describe("formatOaiDate", () => {
  it("returns undefined for an invalid Date object", () => {
    expect(formatOaiDate(new Date("invalid"))).toBeUndefined();
  });
});

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

    it("strips fractional seconds from datestamps that cannot be parsed as dates", async () => {
      const work = JSON.parse(testFixture("mocks/work-1234.json"));
      work._source.modified_date = "9999-99-99T99:99:99.123456Z";
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(work),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=oai_dc",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const header = resultBody["OAI-PMH"].GetRecord.record.header;
      expect(header.datestamp._text).toEqual("9999-99-99T99:99:99Z");
    });

    it("properly extracts values from complex fields for GetRecord", async () => {
      const work = JSON.parse(testFixture("mocks/work-1234.json"));
      work._source.work_type = { label: "Sound" };
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(work),
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

      // Verify object fields without special handling fall back to label
      expect(metadata["dc:type"]._text).toEqual("Sound");
    });

    it("supports the mods metadataPrefix for the GetRecord verb", async () => {
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/work-1234.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=mods",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(result.headers.get("content-type") ?? "").toMatch(
        /application\/xml/,
      );

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].request._attributes.metadataPrefix).toEqual(
        "mods",
      );

      const record = resultBody["OAI-PMH"].GetRecord.record;
      expect("identifier" in record.header).toBe(true);
      const mods = record.metadata["mods:mods"];
      expect(typeof mods === "object").toBe(true);
      expect(mods._attributes["xmlns:mods"]).toEqual(
        "http://www.loc.gov/mods/v3",
      );

      // titleInfo: main title plus alternate_title and caption as alternatives
      expect(mods["mods:titleInfo"].length).toEqual(3);
      expect(mods["mods:titleInfo"][0]["mods:title"]._text).toEqual(
        "Canary Record TEST 1",
      );
      expect(mods["mods:titleInfo"][1]._attributes.type).toEqual("alternative");
      expect(mods["mods:titleInfo"][1]["mods:title"]._text).toEqual(
        "This is an alternative title",
      );
      expect(mods["mods:titleInfo"][2]["mods:title"]._text).toEqual("Beebo");

      // names: creators first (default role Creator), then contributors with
      // their own roles; valueURI carries the authority URI
      const names = mods["mods:name"];
      expect(names[0]._attributes.valueURI).toEqual(
        "http://id.loc.gov/authorities/names/no2011059409",
      );
      expect(names[0]["mods:namePart"]._text).toEqual("Dessa (Vocalist)");
      expect(names[0]["mods:displayForm"]._text).toEqual("Dessa (Vocalist)");
      expect(names[0]["mods:role"]["mods:roleTerm"]._text).toEqual("Creator");
      const metallica = names.find(
        (n: { [key: string]: { _text: string } }) =>
          n["mods:namePart"]._text === "Metallica (Musical group)",
      );
      expect(metallica["mods:role"]["mods:roleTerm"]._text).toEqual(
        "Cartographer",
      );

      // typeOfResource from work_type
      expect(mods["mods:typeOfResource"]._text).toEqual("still image");
      expect(mods["mods:typeOfResource"]._attributes.valueURI).toEqual(
        "https://www.loc.gov/standards/mods/userguide/typeofresource/img",
      );

      // genre includes both genre and technique terms
      const genres = mods["mods:genre"].map((g: { _text: string }) => g._text);
      expect(genres).toContain("Biographies");
      expect(genres).toContain("drypoint (printing process)");

      // originInfo
      expect(mods["mods:originInfo"]["mods:publisher"]._text).toEqual(
        "Northwestern University Press",
      );
      expect(mods["mods:originInfo"]["mods:dateCreated"][0]._text).toEqual(
        "August 1906 to December 1910",
      );

      // language has text and code terms
      const languageTerms = mods["mods:language"]["mods:languageTerm"];
      expect(languageTerms[0]._text).toEqual("Crimean Tatar");
      expect(languageTerms[1]._text).toEqual("crh");
      expect(languageTerms[1]._attributes.authority).toEqual("iso639-2b");

      // physicalDescription concatenates material and size
      expect(mods["mods:physicalDescription"]["mods:extent"]._text).toEqual(
        "Acrylic paint on cement block; 16 x 24 inches",
      );

      // abstract from description
      expect(mods["mods:abstract"]._text).toEqual(
        "This is a private record for RepoDev testing on production",
      );

      // notes carry displayLabel from note type; scope and contents included
      const notes = mods["mods:note"];
      const generalNote = notes.find(
        (n: { _attributes?: { displayLabel?: string } }) =>
          n._attributes?.displayLabel === "General Note",
      );
      expect(generalNote._text).toEqual("Here are some notes");
      const scopeNote = notes.find(
        (n: { _attributes?: { displayLabel?: string } }) =>
          n._attributes?.displayLabel === "Scope and Contents",
      );
      expect(scopeNote._text).toEqual("I promise there is scope and content");
      const indexingNote = notes.find(
        (n: { _attributes?: { type?: string } }) =>
          n._attributes?.type === "for indexing only",
      );
      expect(indexingNote._text).toContain("Canary Record TEST 1");

      // accessCondition from rights_statement and terms_of_use
      const accessConditions = mods["mods:accessCondition"];
      expect(accessConditions[0]._attributes.type).toEqual("rights");
      expect(accessConditions[0]._attributes["xlink:href"]).toEqual(
        "http://rightsstatements.org/vocab/InC-EDU/1.0/",
      );
      expect(accessConditions[0]._text).toEqual(
        "In Copyright - Educational Use Permitted",
      );
      expect(accessConditions[1]._attributes.type).toEqual(
        "useAndReproduction",
      );
      expect(accessConditions[1]._text).toEqual("Terms");

      // subjects use the right child element for their role
      const subjects = mods["mods:subject"];
      const geographic = subjects.find(
        (s: Record<string, unknown>) => "mods:geographic" in s,
      );
      expect(geographic["mods:geographic"]._text).toEqual("Leelanau");
      const stylePeriod = subjects.find(
        (s: { _attributes?: { valueURI?: string } }) =>
          s._attributes?.valueURI === "http://vocab.getty.edu/aat/300018478",
      );
      expect(stylePeriod["mods:topic"]._text).toEqual(
        "Qing (dynastic styles and periods)",
      );

      // identifiers: local identifiers plus the PID
      const identifiers = mods["mods:identifier"];
      expect(identifiers[0]._text).toEqual("555");
      expect(identifiers[1]._attributes.displayLabel).toEqual("PID");
      expect(identifiers[1]._text).toEqual("1234");

      // locations: item/thumbnail URLs and the physical location
      const locations = mods["mods:location"];
      const urls = locations[0]["mods:url"];
      expect(urls[0]._text).toEqual(
        "https://dc.library.northwestern.edu/items/1234",
      );
      expect(urls[1]._attributes.displayLabel).toEqual("Thumbnail");
      expect(urls[1]._text).toEqual(
        "https://index.test.library.northwestern.edu/iiif/2/mbk-dev/5678/square/100,100/0/default.jpg",
      );
      expect(locations[1]["mods:physicalLocation"]._text).toEqual(
        "Charles Deering McCormick Library of Special Collections",
      );
      expect(locations[1]["mods:shelfLocator"]._text).toEqual("555");

      // recordInfo
      const recordInfo = mods["mods:recordInfo"];
      expect(recordInfo["mods:recordOrigin"]._text).toEqual(
        "Northwestern University Libraries Digital Collections API",
      );
      expect(recordInfo["mods:recordIdentifier"]._text).toEqual("1234");
      expect(recordInfo["mods:recordContentSource"]._text).toEqual("IEN");
      expect(recordInfo["mods:recordChangeDate"]._attributes.encoding).toEqual(
        "iso8601",
      );
      expect(recordInfo["mods:recordChangeDate"]._text).toMatch(/^\d{14}\.0$/);
      expect(Object.keys(recordInfo)).toEqual([
        "mods:recordOrigin",
        "mods:recordContentSource",
        "mods:recordCreationDate",
        "mods:recordChangeDate",
        "mods:recordIdentifier",
        "mods:languageOfCataloging",
        "mods:recordInfoNote",
      ]);

      // relatedItems: collection host, series, related URLs, source system
      const relatedItems = mods["mods:relatedItem"];
      const collection = relatedItems.find(
        (r: { _attributes?: { displayLabel?: string } }) =>
          r._attributes?.displayLabel === "Collection",
      );
      expect(collection["mods:titleInfo"]["mods:title"]._text).toEqual(
        "TEST Canary Records",
      );
      expect(collection["mods:identifier"]._text).toEqual(
        "7c50096c-89eb-43e8-b357-5836a788ddeb",
      );
      const series = relatedItems.find(
        (r: { _attributes?: { type?: string } }) =>
          r._attributes?.type === "series",
      );
      expect(series["mods:titleInfo"]["mods:title"]._text).toEqual(
        "Canaries and How to Care for Them",
      );
      const findingAid = relatedItems.find(
        (r: { _attributes?: { displayLabel?: string } }) =>
          r._attributes?.displayLabel === "Finding Aid",
      );
      expect(findingAid["mods:location"]["mods:url"]._text).toEqual(
        "https://findingaids.library.northwestern.edu/",
      );
      const sourceSystem = relatedItems.find(
        (r: { _attributes?: { otherType?: string } }) =>
          r._attributes?.otherType === "sourceSystem",
      );
      expect(sourceSystem["mods:titleInfo"]["mods:title"]._text).toEqual(
        "Digital Collections Images Repository",
      );
    });

    it("returns cannotDisseminateFormat for an unsupported metadataPrefix", async () => {
      const req = buildRequest("POST", "/oai", {
        body: "verb=GetRecord&identifier=1234&metadataPrefix=marc21",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);

      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "cannotDisseminateFormat",
      );
    });

    it("supports the mods metadataPrefix for the ListRecords verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListRecords&metadataPrefix=mods",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const records = resultBody["OAI-PMH"].ListRecords.record;
      expect(records.length).toEqual(12);
      for (const record of records) {
        expect("mods:mods" in record.metadata).toBe(true);
        expect("oai_dc:dc" in record.metadata).toBe(false);
      }

      // resumptionToken carries the metadata format so subsequent
      // token-only requests keep producing MODS
      const resumptionToken = resultBody["OAI-PMH"].ListRecords.resumptionToken;
      expect(resumptionToken._text.startsWith("mods:")).toBe(true);
    });

    it("resumes a MODS ListRecords request from a mods-prefixed resumptionToken", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/${SCROLL_TOKEN}`,
          () => HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&resumptionToken=mods:${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const records = resultBody["OAI-PMH"].ListRecords.record;
      expect(records.length).toEqual(12);
      for (const record of records) {
        expect("mods:mods" in record.metadata).toBe(true);
      }
      const resumptionToken = resultBody["OAI-PMH"].ListRecords.resumptionToken;
      expect(resumptionToken._text.startsWith("mods:")).toBe(true);
    });

    it("treats a resumptionToken with an unrecognized prefix as a plain oai_dc token", async () => {
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/_search/scroll/unknown\\:${SCROLL_TOKEN}`,
          () => HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: `verb=ListRecords&resumptionToken=unknown:${SCROLL_TOKEN}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const records = resultBody["OAI-PMH"].ListRecords.record;
      expect(records.length).toEqual(12);
      for (const record of records) {
        expect("oai_dc:dc" in record.metadata).toBe(true);
      }
    });

    it("supports the mods metadataPrefix for the ListIdentifiers verb", async () => {
      server.use(
        http.post(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_search`, () =>
          HttpResponse.json(JSON.parse(testFixture("mocks/scroll.json"))),
        ),
      );

      const req = buildRequest("POST", "/oai", {
        body: "verb=ListIdentifiers&metadataPrefix=mods",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);

      const resultBody = parseXml(await result.text());
      const resumptionToken =
        resultBody["OAI-PMH"].ListIdentifiers.resumptionToken;
      expect(resumptionToken._text.startsWith("mods:")).toBe(true);
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
      const metadataFormats =
        resultBody["OAI-PMH"].ListMetadataFormats.metadataFormat;
      expect(metadataFormats.length).toEqual(2);
      expect(metadataFormats[0].metadataPrefix._text).toEqual("oai_dc");
      expect(metadataFormats[0].metadataNamespace._text).toEqual(
        "http://www.openarchives.org/OAI/2.0/oai_dc/",
      );
      expect(metadataFormats[1].metadataPrefix._text).toEqual("mods");
      expect(metadataFormats[1].metadataNamespace._text).toEqual(
        "http://www.loc.gov/mods/v3",
      );
      expect(metadataFormats[1].schema._text).toEqual(
        "http://www.loc.gov/standards/mods/v3/mods-3-7.xsd",
      );
    });
  });

  describe("visibility", () => {
    // OAI-PMH only exposes metadata, so it should include works visible to
    // authenticated (netID / "Institution") users as well as "Public" ones,
    // matching what the unauthenticated DC API returns.
    const expectedFilter = [
      { term: { published: true } },
      { terms: { visibility: ["Institution", "Public"] } },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function captureSearch(index: string, fixture: string): { body?: any } {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const captured: { body?: any } = {};
      server.use(
        http.post(
          `https://${TEST_OPENSEARCH_HOST}/${index}/_search`,
          async ({ request }) => {
            captured.body = await request.json();
            return HttpResponse.json(JSON.parse(testFixture(fixture)));
          },
        ),
      );
      return captured;
    }

    it("includes Institution and Public works in ListRecords", async () => {
      const captured = captureSearch("dc-v2-work", "mocks/scroll.json");
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListRecords", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(captured.body.query.bool.must).toEqual(
        expect.arrayContaining(expectedFilter),
      );
      expect(captured.body.query.bool.must).not.toContainEqual({
        term: { visibility: "Public" },
      });
    });

    it("includes Institution and Public works in ListIdentifiers", async () => {
      const captured = captureSearch("dc-v2-work", "mocks/scroll.json");
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListIdentifiers", metadataPrefix: "oai_dc" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(captured.body.query.bool.must).toEqual(
        expect.arrayContaining(expectedFilter),
      );
    });

    it("includes Institution and Public works when filtering by set", async () => {
      const captured = captureSearch(
        "dc-v2-work",
        "mocks/oai-list-identifiers-sets.json",
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
      expect(captured.body.query.bool.must).toEqual(
        expect.arrayContaining([
          ...expectedFilter,
          { term: { "collection.id": "c4f30015-88b5-4291-b3a6-8ac9b7c7069c" } },
        ]),
      );
    });

    it("includes Institution and Public collections in ListSets", async () => {
      const captured = captureSearch("dc-v2-collection", "mocks/oai-sets.json");
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListSets" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(captured.body.query.bool.must).toEqual(
        expect.arrayContaining(expectedFilter),
      );
    });

    it("considers Institution and Public works for the Identify earliestDatestamp", async () => {
      const captured = captureSearch(
        "dc-v2-work",
        "mocks/search-earliest-record.json",
      );
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "Identify" },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(200);
      expect(captured.body.query.bool.must).toEqual(
        expect.arrayContaining(expectedFilter),
      );
    });

    function getRecordWith(overrides: Record<string, unknown>) {
      const fixture = JSON.parse(testFixture("mocks/work-1234.json"));
      fixture._source = { ...fixture._source, ...overrides };
      server.use(
        http.get(`https://${TEST_OPENSEARCH_HOST}/dc-v2-work/_doc/1234`, () =>
          HttpResponse.json(fixture),
        ),
      );
      return sendRequest(
        buildRequest("GET", "/oai", {
          queryParams: {
            verb: "GetRecord",
            identifier: "1234",
            metadataPrefix: "oai_dc",
          },
        }),
      );
    }

    it("returns Institution works from GetRecord", async () => {
      const result = await getRecordWith({ visibility: "Institution" });
      expect(result.status).toEqual(200);
      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].GetRecord.record).toBeDefined();
    });

    it("returns idDoesNotExist for Private works in GetRecord", async () => {
      const result = await getRecordWith({ visibility: "Private" });
      expect(result.status).toEqual(404);
      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "idDoesNotExist",
      );
    });

    it("returns idDoesNotExist for unpublished works in GetRecord", async () => {
      const result = await getRecordWith({ published: false });
      expect(result.status).toEqual(404);
      const resultBody = parseXml(await result.text());
      expect(resultBody["OAI-PMH"].error._attributes.code).toEqual(
        "idDoesNotExist",
      );
    });

    it("never exposes Private or unpublished works", async () => {
      const captured = captureSearch("dc-v2-work", "mocks/scroll.json");
      const req = buildRequest("GET", "/oai", {
        queryParams: { verb: "ListRecords", metadataPrefix: "oai_dc" },
      });
      await sendRequest(req);
      const { must } = captured.body.query.bool;
      const visibility = must.find(
        (clause: Record<string, unknown>) =>
          "terms" in clause &&
          "visibility" in (clause.terms as Record<string, unknown>),
      );
      expect(visibility.terms.visibility).not.toContain("Private");
      expect(must).toContainEqual({ term: { published: true } });
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
