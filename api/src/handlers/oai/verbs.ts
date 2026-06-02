import { invalidOaiRequest, output } from "../oai/xml-transformer.ts";
import { earliestRecord, oaiSearch, oaiSets } from "../oai/search.ts";
import { deleteScroll, getWork, scroll } from "../../api/opensearch.ts";
import { formatOaiDate } from "./date-utils.ts";
import type {
  OpenSearchGetResponse,
  OpenSearchSearchResponse,
} from "../../api/opensearch-types.ts";

const fieldMapper: Record<string, string> = {
  contributor: "dc:contributor",
  create_date: "dc:date",
  description: "dc:description",
  title: "dc:title",
  id: "dc:identifier",
  language: "dc:language",
  creator: "dc:creator",
  physical_description_material: "dc:format",
  publisher: "dc:publisher",
  related_material: "dc:relation",
  rights_statement: "dc:rights",
  source: "dc:source",
  subject: "dc:subject",
  work_type: "dc:type",
};

const oaiAttributes = {
  xmlns: "http://www.openarchives.org/OAI/2.0/",
  "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
  "xsi:schemaLocation":
    "http://www.openarchives.org/OAI/2.0/\nhttp://www.openarchives.org/OAI/2.0/OAI_PMH.xsd",
};

function extractDcValue(fieldName: string, fieldValue: unknown): unknown {
  if (!fieldValue) return null;

  if (
    typeof fieldValue === "string" ||
    (Array.isArray(fieldValue) && typeof fieldValue[0] === "string")
  ) {
    return fieldValue;
  }

  if (!Array.isArray(fieldValue) && typeof fieldValue === "object") {
    return extractSingleValue(fieldName, fieldValue as Record<string, unknown>);
  }

  if (Array.isArray(fieldValue) && typeof fieldValue[0] === "object") {
    const extracted = fieldValue.map((item) =>
      extractSingleValue(fieldName, item as Record<string, unknown>),
    );
    return extracted.filter((val) => val !== null);
  }

  return fieldValue;
}

function extractSingleValue(
  fieldName: string,
  item: Record<string, unknown>,
): unknown {
  if (!item) return null;

  switch (fieldName) {
    case "subject":
    case "contributor":
      return item.label_with_role || item.label || null;
    case "language":
      if (item.id && typeof item.id === "string") return item.id;
      return item.label || null;
    case "creator":
      return item.label || null;
    case "rights_statement":
      return item.label || null;
    default:
      return item.label || item;
  }
}

function header(work: Record<string, unknown>): Record<string, unknown> {
  let fields: Record<string, unknown> = {
    identifier: work.id,
    datestamp: formatOaiDate(work.modified_date as string),
  };

  if (work?.collection && Object.keys(work.collection as object).length > 0) {
    fields = {
      ...fields,
      setSpec: (work.collection as Record<string, unknown>).id,
    };
  }

  return fields;
}

function transform(work: Record<string, unknown>): Record<string, unknown> {
  const filteredWork = Object.keys(work)
    .filter((key) => Object.keys(fieldMapper).includes(key))
    .reduce((obj: Record<string, unknown>, key) => {
      const dcFieldName = fieldMapper[key];
      const extractedValue = extractDcValue(key, work[key]);

      if (
        extractedValue !== null &&
        extractedValue !== undefined &&
        !(Array.isArray(extractedValue) && extractedValue.length === 0)
      ) {
        obj[dcFieldName] = extractedValue;
      }

      return obj;
    }, {});

  const metadata = {
    metadata: {
      "oai_dc:dc": {
        _attributes: {
          "xmlns:oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
          "xmlns:dc": "http://purl.org/dc/elements/1.1/",
          "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "xsi:schemaLocation":
            "http://www.openarchives.org/OAI/2.0/oai_dc/\nhttp://www.openarchives.org/OAI/2.0/oai_dc.xsd",
        },
        ...filteredWork,
      },
    },
  };

  return { header: { ...header(work) }, ...metadata };
}

export const getRecord = async (
  url: string,
  id: string | undefined,
): Promise<Response> => {
  if (!id)
    return invalidOaiRequest(
      "badArgument",
      "You must supply an identifier for GetRecord requests",
    );

  const esResponse = await getWork(id);
  if (esResponse.status === 200) {
    const work = (
      JSON.parse(esResponse.body) as OpenSearchGetResponse<
        Record<string, unknown>
      >
    )._source!;
    const record = transform(work);
    const document = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: {
          _attributes: {
            verb: "GetRecord",
            identifier: id,
            metadataPrefix: "oai_dc",
          },
          _text: url,
        },
        GetRecord: { record },
      },
    };
    return output(document);
  } else {
    return invalidOaiRequest(
      "idDoesNotExist",
      "The specified record does not exist",
      404,
    );
  }
};

export const identify = async (url: string): Promise<Response> => {
  const earliestDatestamp = await earliestRecord();
  const obj = {
    "OAI-PMH": {
      _attributes: oaiAttributes,
      responseDate: formatOaiDate(new Date()),
      request: { _attributes: { verb: "Identify" }, _text: url },
      Identify: {
        repositoryName: "Northwestern University Libraries",
        baseURL: url,
        protocolVersion: "2.0",
        adminEmail: "repository@northwestern.edu",
        earliestDatestamp: formatOaiDate(earliestDatestamp),
        deletedRecord: "no",
        granularity: "YYYY-MM-DDThh:mm:ssZ",
      },
    },
  };
  return output(obj);
};

export const listIdentifiers = async (
  url: string,
  metadataPrefix: string | undefined,
  dates: { from?: string; until?: string },
  set: string | undefined,
  resumptionToken: string | undefined,
): Promise<Response> => {
  if (!resumptionToken && !metadataPrefix) {
    return invalidOaiRequest(
      "badArgument",
      "Missing required metadataPrefix argument",
    );
  }
  const response =
    typeof resumptionToken === "string" && resumptionToken.length !== 0
      ? await scroll(resumptionToken)
      : await oaiSearch(dates, set);

  if (response.status === 200) {
    const responseBody = JSON.parse(response.body) as OpenSearchSearchResponse<
      Record<string, unknown>
    >;
    const {
      hits: { hits },
    } = responseBody;
    let scrollId = responseBody._scroll_id ?? "";

    if (hits.length === 0) {
      await deleteScroll(scrollId);
      scrollId = "";
    }

    const headers = hits.map((hit) => header(hit._source));
    const resumptionTokenElement = {
      _attributes: {
        expirationDate: formatOaiDate(
          (response as { expiration?: string }).expiration,
        ),
      },
      _text: scrollId,
    };
    const obj = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: {
          _attributes: {
            verb: "ListIdentifiers",
            ...(resumptionToken && { resumptionToken }),
          },
          _text: url,
        },
        ListIdentifiers: {
          header: headers,
          resumptionToken: resumptionTokenElement,
        },
      },
    };
    return output(obj);
  } else if (
    response.status === 404 &&
    response.body.match(/No search context found/)
  ) {
    return invalidOaiRequest(
      "badResumptionToken",
      "Your resumptionToken is no longer valid",
      401,
    );
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListIdentifiers request",
    );
  }
};

export const listMetadataFormats = (url: string): Response => {
  const obj = {
    "OAI-PMH": {
      _attributes: oaiAttributes,
      responseDate: formatOaiDate(new Date()),
      request: { _attributes: { verb: "ListMetadataFormats" }, _text: url },
      ListMetadataFormats: {
        metadataFormat: {
          metadataPrefix: "oai_dc",
          schema: "http://www.openarchives.org/OAI/2.0/oai_dc.xsd",
          metadataNamespace: "http://www.openarchives.org/OAI/2.0/oai_dc/",
        },
      },
    },
  };
  return output(obj);
};

export const listRecords = async (
  url: string,
  metadataPrefix: string | undefined,
  dates: { from?: string; until?: string },
  set: string | undefined,
  resumptionToken: string | undefined,
): Promise<Response> => {
  if (!resumptionToken && !metadataPrefix) {
    return invalidOaiRequest(
      "badArgument",
      "Missing required metadataPrefix argument",
    );
  }
  const response =
    typeof resumptionToken === "string" && resumptionToken.length !== 0
      ? await scroll(resumptionToken)
      : await oaiSearch(dates, set);

  if (response.status === 200) {
    const responseBody = JSON.parse(response.body) as OpenSearchSearchResponse<
      Record<string, unknown>
    >;
    const {
      hits: { hits },
    } = responseBody;
    let scrollId = responseBody._scroll_id ?? "";

    if (hits.length === 0) {
      await deleteScroll(scrollId);
      scrollId = "";
    }

    const records = hits.map((hit) => transform(hit._source));
    const resumptionTokenElement = {
      _attributes: {
        expirationDate: formatOaiDate(
          (response as { expiration?: string }).expiration,
        ),
      },
      _text: scrollId,
    };
    const obj = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: { _attributes: { verb: "ListRecords" }, _text: url },
        ListRecords: {
          record: records,
          resumptionToken: resumptionTokenElement,
        },
      },
    };
    return output(obj);
  } else if (
    response.status === 404 &&
    response.body.match(/No search context found/)
  ) {
    return invalidOaiRequest(
      "badResumptionToken",
      "Your resumptionToken is no longer valid",
      401,
    );
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListRecords request",
    );
  }
};

export const listSets = async (url: string): Promise<Response> => {
  const response = await oaiSets();
  if (response.status === 200) {
    const responseBody = JSON.parse(response.body) as OpenSearchSearchResponse<
      Record<string, unknown>
    >;
    const {
      hits: { hits },
    } = responseBody;

    const sets = hits.map((hit) => ({
      setSpec: hit._source.id,
      setName: hit._source.title,
    }));

    const obj = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: { _attributes: { verb: "ListSets" }, _text: url },
        ListSets: { set: sets },
      },
    };
    return output(obj);
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListSets request",
      response.status,
    );
  }
};
