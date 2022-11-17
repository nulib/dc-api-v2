const { processRequest } = require("./middleware");
const { baseUrl } = require("../helpers");
const {
  getRecord,
  identify,
  listIdentifiers,
  listMetadataFormats,
  listRecords,
} = require("./oai/verbs");
const { invalidOaiRequest } = require("./oai/xml-transformer");

const allowedVerbs = [
  "GetRecord",
  "Identify",
  "ListIdentifiers",
  "ListMetadataFormats",
  "ListRecords",
  "ListSets",
];

/**
 * A function to support the OAI-PMH harvesting specfication
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const url = `${baseUrl(event)}oai`;
  let verb, identifier, metadataPrefix, resumptionToken;
  if (event.requestContext.http.method === "GET") {
    verb = event.queryStringParameters?.verb;
    identifier = event.queryStringParameters?.identifier;
    metadataPrefix = event.queryStringParameters?.metadataPrefix;
    resumptionToken = event.queryStringParameters?.resumptionToken;
  } else {
    const body = new URLSearchParams(event.body);
    verb = body.get("verb");
    identifier = body.get("identifier");
    metadataPrefix = body.get("metadataPrefix");
    resumptionToken = body.get("resumptionToken");
  }

  if (!verb) return invalidOaiRequest("badArgument", "Missing required verb");

  switch (verb) {
    case "GetRecord":
      return await getRecord(url, identifier, metadataPrefix);
    case "Identify":
      return await identify(url);
    case "ListIdentifiers":
      return await listIdentifiers(url, event, metadataPrefix, resumptionToken);
    case "ListMetadataFormats":
      return await listMetadataFormats(url);
    case "ListRecords":
      return await listRecords(url, event, metadataPrefix, resumptionToken);
    case "ListSets":
      return invalidOaiRequest(
        "noSetHierarchy",
        "This repository does not support Sets",
        401
      );
    default:
      return invalidOaiRequest("badVerb", "Illegal OAI verb");
  }
};
