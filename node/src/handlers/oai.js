const { baseUrl } = require("../helpers");
const {
  getRecord,
  identify,
  listIdentifiers,
  listMetadataFormats,
  listRecords,
  listSets,
} = require("./oai/verbs");
const { invalidOaiRequest } = require("./oai/xml-transformer");
const { wrap } = require("./middleware");

function invalidDateParameters(verb, dates) {
  if (!["ListRecords", "ListIdentifiers"].includes(verb)) return [];

  const regex = new RegExp(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  let invalidDates = [];

  for (const [dateParameter, dateValue] of Object.entries(dates)) {
    if (dateValue && !regex.test(dateValue)) {
      invalidDates.push(dateParameter);
    } else {
      continue;
    }
  }

  return invalidDates;
}

/**
 * A function to support the "OAI-PMH" harvesting specfication
 */
exports.handler = wrap(async (event) => {
  const url = `${baseUrl(event)}oai`;
  let verb, identifier, metadataPrefix, resumptionToken, from, until, set;
  if (event.requestContext.http.method === "GET") {
    verb = event.queryStringParameters?.verb;
    identifier = event.queryStringParameters?.identifier;
    metadataPrefix = event.queryStringParameters?.metadataPrefix;
    resumptionToken = event.queryStringParameters?.resumptionToken;
    from = event.queryStringParameters?.from;
    until = event.queryStringParameters?.until;
    set = event.queryStringParameters?.set;
  } else {
    const body = new URLSearchParams(event.body);
    verb = body.get("verb");
    identifier = body.get("identifier");
    metadataPrefix = body.get("metadataPrefix");
    resumptionToken = body.get("resumptionToken");
    from = body.get("from");
    until = body.get("until");
    set = body.get("set");
  }

  const dates = { from, until };
  if (invalidDateParameters(verb, dates).length > 0)
    return invalidOaiRequest(
      "badArgument",
      "Invalid date -- make sure that 'from' or 'until' parameters are formatted as: 'YYYY-MM-DDThh:mm:ss.ffffffZ'"
    );
  if (!verb) return invalidOaiRequest("badArgument", "Missing required verb");

  switch (verb) {
    case "GetRecord":
      return await getRecord(url, identifier, metadataPrefix);
    case "Identify":
      return await identify(url);
    case "ListIdentifiers":
      return await listIdentifiers(
        url,
        metadataPrefix,
        dates,
        set,
        resumptionToken
      );
    case "ListMetadataFormats":
      return await listMetadataFormats(url);
    case "ListRecords":
      return await listRecords(
        url,
        metadataPrefix,
        dates,
        set,
        resumptionToken
      );
    case "ListSets":
      return await listSets(url, resumptionToken);
    default:
      return invalidOaiRequest("badVerb", "Illegal OAI verb");
  }
});
