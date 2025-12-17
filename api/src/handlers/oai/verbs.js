const { invalidOaiRequest, output } = require("../oai/xml-transformer");
const { earliestRecord, oaiSearch, oaiSets } = require("../oai/search");
const { deleteScroll, getWork, scroll } = require("../../api/opensearch");
const { formatOaiDate } = require("./date-utils");

const fieldMapper = {
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

function extractDcValue(fieldName, fieldValue) {
  // Handle null/undefined
  if (!fieldValue) return null;

  // Handle simple string or array of strings (title, description, etc.)
  if (
    typeof fieldValue === "string" ||
    (Array.isArray(fieldValue) && typeof fieldValue[0] === "string")
  ) {
    return fieldValue;
  }

  // Handle single object fields (rights_statement)
  if (!Array.isArray(fieldValue) && typeof fieldValue === "object") {
    return extractSingleValue(fieldName, fieldValue);
  }

  // Handle array of objects (subject, contributor, creator, language)
  if (Array.isArray(fieldValue) && typeof fieldValue[0] === "object") {
    const extracted = fieldValue.map((item) =>
      extractSingleValue(fieldName, item)
    );
    return extracted.filter((val) => val !== null); // Remove nulls
  }

  return fieldValue;
}

function extractSingleValue(fieldName, item) {
  if (!item) return null;

  switch (fieldName) {
    case "subject":
    case "contributor":
      // Use label_with_role if available, fallback to label
      return item.label_with_role || item.label || null;

    case "language":
      // Use the full URI (e.g., 'http://id.loc.gov/vocabulary/languages/crh')
      if (item.id && typeof item.id === "string") {
        return item.id;
      }
      return item.label || null;

    case "creator":
      // Use label field
      return item.label || null;

    case "rights_statement":
      // Use label field
      return item.label || null;

    default:
      // For unknown complex types, try label field or return as-is
      return item.label || item;
  }
}

function header(work) {
  let fields = {
    identifier: work.id,
    datestamp: formatOaiDate(work.modified_date),
  };

  if (work?.collection && Object.keys(work.collection).length > 0) {
    fields = {
      ...fields,
      setSpec: work.collection.id,
    };
  }

  return fields;
}

function transform(work) {
  const filteredWork = Object.keys(work)
    .filter((key) => Object.keys(fieldMapper).includes(key))
    .reduce((obj, key) => {
      const dcFieldName = fieldMapper[key];
      const extractedValue = extractDcValue(key, work[key]);

      // Only include field if it has a value
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

const getRecord = async (url, id) => {
  if (!id)
    return invalidOaiRequest(
      "badArgument",
      "You must supply an identifier for GetRecord requests"
    );
  const esResponse = await getWork(id);
  if (esResponse.statusCode == 200) {
    const work = JSON.parse(esResponse.body)._source;
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
        GetRecord: { record: record },
      },
    };
    return output(document);
  } else {
    return invalidOaiRequest(
      "idDoesNotExist",
      "The specified record does not exist",
      404
    );
  }
};

const identify = async (url) => {
  let earliestDatestamp = await earliestRecord();
  const obj = {
    "OAI-PMH": {
      _attributes: oaiAttributes,
      responseDate: formatOaiDate(new Date()),
      request: {
        _attributes: {
          verb: "Identify",
        },
        _text: url,
      },
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

const listIdentifiers = async (
  url,
  metadataPrefix,
  dates,
  set,
  resumptionToken
) => {
  if (!metadataPrefix) {
    return invalidOaiRequest(
      "badArgument",
      "Missing required metadataPrefix argument"
    );
  }
  const response =
    typeof resumptionToken === "string" && resumptionToken.length !== 0
      ? await scroll(resumptionToken)
      : await oaiSearch(dates, set);
  let resumptionTokenElement;

  if (response.statusCode == 200) {
    const responseBody = JSON.parse(response.body);
    const hits = responseBody.hits.hits;
    let scrollId = responseBody._scroll_id;

    if (hits.length === 0) {
      await deleteScroll(scrollId);
      scrollId = "";
    }

    const headers = hits.map((hit) => header(hit._source));
    resumptionTokenElement = {
      _attributes: {
        expirationDate: formatOaiDate(response.expiration),
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
            ...(resumptionToken && { resumptionToken: resumptionToken }),
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
    response.statusCode === 404 &&
    response.body.match(/No search context found/)
  ) {
    return invalidOaiRequest(
      "badResumptionToken",
      "Your resumptionToken is no longer valid",
      401
    );
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListIdentifiers request"
    );
  }
};

const listMetadataFormats = (url) => {
  const obj = {
    "OAI-PMH": {
      _attributes: oaiAttributes,
      responseDate: formatOaiDate(new Date()),
      request: {
        _attributes: {
          verb: "ListMetadataFormats",
        },
        _text: url,
      },
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

const listRecords = async (
  url,
  metadataPrefix,
  dates,
  set,
  resumptionToken
) => {
  if (!metadataPrefix) {
    return invalidOaiRequest(
      "badArgument",
      "Missing required metadataPrefix argument"
    );
  }
  const response =
    typeof resumptionToken === "string" && resumptionToken.length !== 0
      ? await scroll(resumptionToken)
      : await oaiSearch(dates, set);
  let records = [];
  let resumptionTokenElement;

  if (response.statusCode == 200) {
    const responseBody = JSON.parse(response.body);
    const hits = responseBody.hits.hits;
    let scrollId = responseBody._scroll_id;

    if (hits.length === 0) {
      await deleteScroll(scrollId);
      scrollId = "";
    }
    records = hits.map((hit) => transform(hit._source));
    resumptionTokenElement = {
      _attributes: {
        expirationDate: formatOaiDate(response.expiration),
      },
      _text: scrollId,
    };
    const obj = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: {
          _attributes: {
            verb: "ListRecords",
          },
          _text: url,
        },
        ListRecords: {
          record: records,
          resumptionToken: resumptionTokenElement,
        },
      },
    };

    return output(obj);
  } else if (
    response.statusCode === 404 &&
    response.body.match(/No search context found/)
  ) {
    return invalidOaiRequest(
      "badResumptionToken",
      "Your resumptionToken is no longer valid",
      401
    );
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListRecords request"
    );
  }
};

const listSets = async (url) => {
  const response = await oaiSets();
  if (response.statusCode == 200) {
    const responseBody = JSON.parse(response.body);
    const hits = responseBody.hits.hits;

    const sets = hits.map((hit) => {
      const collection = hit._source;
      return {
        setSpec: collection.id,
        setName: collection.title,
      };
    });

    const obj = {
      "OAI-PMH": {
        _attributes: oaiAttributes,
        responseDate: formatOaiDate(new Date()),
        request: {
          _attributes: {
            verb: "ListSets",
          },
          _text: url,
        },
        ListSets: { set: sets },
      },
    };

    return output(obj);
  } else {
    return invalidOaiRequest(
      "badRequest",
      "An error occurred processing the ListSets request",
      response.statusCode
    );
  }
};

module.exports = {
  getRecord,
  identify,
  listIdentifiers,
  listMetadataFormats,
  listRecords,
  listSets,
};
