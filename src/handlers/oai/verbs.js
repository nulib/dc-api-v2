const { invalidOaiRequest, output } = require("../oai/xml-transformer");
const { earliestRecord, oaiSearch } = require("../oai/search");
const { deleteScroll, getWork, scroll } = require("../../api/opensearch");

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
    "http://www.openarchives.org/OAI/2.0/\nhttp://www.openarchives.org/OAI/2.0/OAI-PMH.xsd",
};

function header(work) {
  return { header: { identifier: work.id, datestamp: work.create_date } };
}

function transform(work) {
  const filteredWork = Object.keys(work)
    .filter((key) => Object.keys(fieldMapper).includes(key))
    .reduce((obj, key) => {
      obj[fieldMapper[key]] = work[key];
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

  return { ...header(work), ...metadata };
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
      OAI_PMH: {
        _attributes: oaiAttributes,
        responseDate: new Date().toISOString(),
        request: {
          _attributes: {
            verb: "GetRecord",
            identifier: id,
            metadataPrefix: "oai_dc",
          },
          _text: url,
        },
        GetRecord: { ...record },
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
    OAI_PMH: {
      _attributes: oaiAttributes,
      responseDate: new Date().toISOString(),
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
        earliestDatestamp: earliestDatestamp,
        deletedRecord: "no",
        granularity: "YYYY-MM-DDThh:mm:ss.ffffffZ",
      },
    },
  };
  return output(obj);
};

const listIdentifiers = async (
  url,
  event,
  metadataPrefix,
  dates,
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
      : await oaiSearch(dates);
  let headers = [];
  let resumptionTokenElement;

  if (response.statusCode == 200) {
    const responseBody = JSON.parse(response.body);
    const hits = responseBody.hits.hits;
    let scrollId = responseBody._scroll_id;

    if (hits.length === 0) {
      await deleteScroll(scrollId);
      scrollId = "";
    }
    headers = hits.map((hit) => header(hit._source));

    resumptionTokenElement = {
      _attributes: {
        expirationDate: response.expiration,
      },
      _text: scrollId,
    };
    const obj = {
      OAI_PMH: {
        _attributes: oaiAttributes,
        responseDate: new Date().toISOString(),
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
    OAI_PMH: {
      _attributes: oaiAttributes,
      responseDate: new Date().toISOString(),
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
  event,
  metadataPrefix,
  dates,
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
      : await oaiSearch(dates);
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
        expirationDate: response.expiration,
      },
      _text: scrollId,
    };
    const obj = {
      OAI_PMH: {
        _attributes: oaiAttributes,
        responseDate: new Date().toISOString(),
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

module.exports = {
  getRecord,
  identify,
  listIdentifiers,
  listMetadataFormats,
  listRecords,
};
