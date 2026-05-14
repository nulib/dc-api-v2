import { baseUrl } from "../helpers.ts";
import type { AppEnv } from "../types.ts";
import {
  getRecord,
  identify,
  listIdentifiers,
  listMetadataFormats,
  listRecords,
  listSets,
} from "./oai/verbs.ts";
import { invalidOaiRequest } from "./oai/xml-transformer.ts";
import type { Context } from "hono";

function invalidDateParameters(
  verb: string | undefined,
  dates: Record<string, string | undefined>,
): string[] {
  if (!["ListRecords", "ListIdentifiers"].includes(verb ?? "")) return [];

  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  const invalidDates: string[] = [];

  for (const [dateParameter, dateValue] of Object.entries(dates)) {
    if (
      dateValue &&
      !dateOnlyRegex.test(dateValue) &&
      !dateTimeRegex.test(dateValue)
    ) {
      invalidDates.push(dateParameter);
    }
  }

  return invalidDates;
}

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const url = `${baseUrl(c)}oai`;
  let verb: string | undefined,
    identifier: string | undefined,
    metadataPrefix: string | undefined,
    resumptionToken: string | undefined,
    from: string | undefined,
    until: string | undefined,
    set: string | undefined;

  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    verb = params.get("verb") ?? undefined;
    identifier = params.get("identifier") ?? undefined;
    metadataPrefix = params.get("metadataPrefix") ?? undefined;
    resumptionToken = params.get("resumptionToken") ?? undefined;
    from = params.get("from") ?? undefined;
    until = params.get("until") ?? undefined;
    set = params.get("set") ?? undefined;
  } else {
    const body = new URLSearchParams(await req.text());
    verb = body.get("verb") ?? undefined;
    identifier = body.get("identifier") ?? undefined;
    metadataPrefix = body.get("metadataPrefix") ?? undefined;
    resumptionToken = body.get("resumptionToken") ?? undefined;
    from = body.get("from") ?? undefined;
    until = body.get("until") ?? undefined;
    set = body.get("set") ?? undefined;
  }

  const dates = { from, until };
  if (invalidDateParameters(verb, dates).length > 0)
    return invalidOaiRequest(
      "badArgument",
      "Invalid date -- make sure that 'from' or 'until' parameters are formatted as: 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm:ssZ'",
    );
  if (!verb) return invalidOaiRequest("badArgument", "Missing required verb");

  switch (verb) {
    case "GetRecord":
      return await getRecord(url, identifier);
    case "Identify":
      return await identify(url);
    case "ListIdentifiers":
      return await listIdentifiers(
        url,
        metadataPrefix,
        dates,
        set,
        resumptionToken,
      );
    case "ListMetadataFormats":
      return await listMetadataFormats(url);
    case "ListRecords":
      return await listRecords(
        url,
        metadataPrefix,
        dates,
        set,
        resumptionToken,
      );
    case "ListSets":
      return await listSets(url);
    default:
      return await invalidOaiRequest("badVerb", "Illegal OAI verb");
  }
};
