import convert from "xml-js";
import { appInfo } from "../../../environment.ts";
import { transformError } from "../error.ts";
import type { OpenSearchGetResponse } from "../../opensearch-types.ts";
import type {
  PremisAgent,
  PremisEvent,
  PremisExport,
  PremisIdentifier,
  PremisObject,
  PremisRights,
  ProvenanceWorkSource,
} from "./types.ts";

export const PREMIS_NAMESPACE = "http://www.loc.gov/premis/v3";
const PREMIS_SCHEMA = "https://www.loc.gov/standards/premis/v3/premis.xsd";
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";

// Library of Congress preservation vocabularies. Terms in them are tagged with
// their authority; Meadow's own terms (e.g. "metadata generation") are not.
const LOC_VOCABULARY = "http://id.loc.gov/vocabulary/preservation";
const LOC_EVENT_TYPES = new Set([
  "creation",
  "deletion",
  "metadata extraction",
  "metadata modification",
  "modification",
  "replication",
  "transfer",
  "validation",
]);
const LOC_AGENT_TYPES = new Set([
  "hardware",
  "organization",
  "person",
  "software",
]);

// Meadow's object categories are the names of the PREMIS object types.
const OBJECT_TYPES: Record<string, string> = {
  intellectual_entity: "intellectualEntity",
  representation: "representation",
  file: "file",
  bitstream: "bitstream",
};
// Object types whose schema requires objectCharacteristics (and so a format).
const CHARACTERIZED_TYPES = new Set(["file", "bitstream"]);
const UNKNOWN_FORMAT = "application/octet-stream";

const WORK_IDENTIFIER_TYPE = "Meadow Work";
const ACTIVITY_IDENTIFIER_TYPE = "Meadow AI activity";

type XmlNode = Record<string, unknown>;

/**
 * The AI provenance of a work's metadata as PREMIS 3.0.
 *
 * The default response is PREMIS XML, valid against the Library of Congress
 * schema. `Accept: application/json` returns Meadow's PREMIS-shaped projection
 * instead, as indexed. A work no AI activity has touched gets a document
 * describing the work with no events, rather than a 404.
 */
export async function transform(
  response: { status: number; body: string },
  options: { accept?: string | null } = {},
): Promise<Response> {
  if (response.status !== 200) return transformError(response);

  const source = (
    JSON.parse(response.body) as OpenSearchGetResponse<ProvenanceWorkSource>
  )._source!;
  const data = source.ai_provenance_exports?.premis ?? emptyExport(source);

  if (wantsJson(options.accept)) {
    return new Response(JSON.stringify({ data, info: appInfo() }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const body = convert.js2xml(
    {
      _declaration: { _attributes: { version: "1.0", encoding: "utf-8" } },
      "premis:premis": premisDocument(data, source),
    },
    { compact: true, spaces: 2 },
  );
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml" },
  });
}

function wantsJson(accept?: string | null): boolean {
  return !!accept && /application\/json/.test(accept) && !/xml/.test(accept);
}

function emptyExport(source: ProvenanceWorkSource): PremisExport {
  return {
    premis_version: "3.0",
    scope: { work_id: source.id },
    objects: [],
    events: [],
    agents: [],
    rights: [],
  };
}

/** The PREMIS document for an export, as an xml-js compact structure. */
export function premisDocument(
  data: PremisExport,
  source: ProvenanceWorkSource,
): XmlNode {
  // The schema requires at least one object.
  const objects =
    data.objects.length > 0 ? data.objects : [workObject(data, source)];

  return {
    _attributes: {
      "xmlns:premis": PREMIS_NAMESPACE,
      "xmlns:xsi": XSI_NAMESPACE,
      "xsi:schemaLocation": `${PREMIS_NAMESPACE} ${PREMIS_SCHEMA}`,
      version: data.premis_version,
    },
    "premis:object": objects.map((object) =>
      objectNode(object, data.events, source),
    ),
    ...repeated("premis:event", data.events.map(eventNode)),
    ...repeated("premis:agent", data.agents.map(agentNode)),
    ...repeated("premis:rights", data.rights.map(rightsNode)),
  };
}

function workObject(
  data: PremisExport,
  source: ProvenanceWorkSource,
): PremisObject {
  return {
    identifier: { type: WORK_IDENTIFIER_TYPE, value: data.scope.work_id },
    category: "intellectual_entity",
    access_link: source.api_link,
  };
}

function objectNode(
  object: PremisObject,
  events: PremisEvent[],
  source: ProvenanceWorkSource,
): XmlNode {
  const type = OBJECT_TYPES[object.category ?? ""] ?? "intellectualEntity";
  const linked = events.filter((event) =>
    sameIdentifier(event.target, object.identifier),
  );

  return {
    _attributes: { "xsi:type": `premis:${type}` },
    "premis:objectIdentifier": identifierNode(
      "objectIdentifier",
      object.identifier,
      object.access_link,
    ),
    ...(CHARACTERIZED_TYPES.has(type)
      ? { "premis:objectCharacteristics": characteristicsNode(object, source) }
      : {}),
    ...repeated(
      "premis:linkingEventIdentifier",
      linked.map((event) =>
        identifierNode("linkingEventIdentifier", event.identifier),
      ),
    ),
  };
}

// The schema requires a format for a file. The projection carries none, so it
// comes from the work's file sets where the object is one of them.
function characteristicsNode(
  object: PremisObject,
  source: ProvenanceWorkSource,
): XmlNode {
  const fileSet = (source.file_sets ?? []).find(
    ({ id }) => id === object.file_set_id,
  );
  const format = fileSet?.mime_type;
  const fixity = object.fixity;

  return {
    ...(fixity?.message_digest && fixity.message_digest_algorithm
      ? {
          "premis:fixity": {
            "premis:messageDigestAlgorithm": text(
              fixity.message_digest_algorithm,
            ),
            "premis:messageDigest": text(fixity.message_digest),
          },
        }
      : {}),
    "premis:format": {
      "premis:formatDesignation": {
        "premis:formatName": text(format || UNKNOWN_FORMAT),
      },
      ...(format ? {} : { "premis:formatNote": text("Format not recorded") }),
    },
  };
}

function eventNode(event: PremisEvent): XmlNode {
  return {
    "premis:eventIdentifier": identifierNode(
      "eventIdentifier",
      event.identifier,
    ),
    "premis:eventType": vocabularyTerm(
      event.type,
      LOC_EVENT_TYPES,
      "eventType",
    ),
    "premis:eventDateTime": text(event.date_time),
    ...(event.activity_id
      ? {
          "premis:eventDetailInformation": {
            "premis:eventDetail": text(
              `${ACTIVITY_IDENTIFIER_TYPE} ${event.activity_id}`,
            ),
          },
        }
      : {}),
    ...(event.outcome || event.outcome_detail
      ? { "premis:eventOutcomeInformation": outcomeNode(event) }
      : {}),
    ...repeated(
      "premis:linkingAgentIdentifier",
      (event.linking_agents ?? [])
        .filter((link) => link.agent_identifier)
        .map((link) => ({
          ...identifierNode("linkingAgentIdentifier", link.agent_identifier!),
          ...(link.role ? { "premis:linkingAgentRole": text(link.role) } : {}),
        })),
    ),
    ...(event.target
      ? {
          "premis:linkingObjectIdentifier": identifierNode(
            "linkingObjectIdentifier",
            event.target,
          ),
        }
      : {}),
  };
}

function outcomeNode(event: PremisEvent): XmlNode {
  return {
    ...(event.outcome ? { "premis:eventOutcome": text(event.outcome) } : {}),
    ...(event.outcome_detail
      ? {
          "premis:eventOutcomeDetail": {
            "premis:eventOutcomeDetailNote": text(event.outcome_detail),
          },
        }
      : {}),
  };
}

function agentNode(agent: PremisAgent): XmlNode {
  // Meadow records people as "human"; PREMIS calls them persons.
  const type = agent.type === "human" ? "person" : agent.type;
  return {
    "premis:agentIdentifier": identifierNode(
      "agentIdentifier",
      agent.identifier,
    ),
    ...(agent.name ? { "premis:agentName": text(agent.name) } : {}),
    ...(type
      ? {
          "premis:agentType": vocabularyTerm(
            type,
            LOC_AGENT_TYPES,
            "agentType",
          ),
        }
      : {}),
    ...(agent.version ? { "premis:agentVersion": text(agent.version) } : {}),
  };
}

// Meadow's rights statements are retention policies, which PREMIS files under
// "other" rights with the basis named in otherRightsInformation.
function rightsNode(rights: PremisRights): XmlNode {
  const notes = [rights.policy, rights.note].filter(Boolean) as string[];
  return {
    "premis:rightsStatement": {
      "premis:rightsStatementIdentifier": identifierNode(
        "rightsStatementIdentifier",
        {
          type: ACTIVITY_IDENTIFIER_TYPE,
          value: rights.activity_id ?? rights.basis,
        },
      ),
      "premis:rightsBasis": text("other"),
      "premis:otherRightsInformation": {
        "premis:otherRightsBasis": text(rights.basis),
        ...repeated("premis:otherRightsNote", notes.map(text)),
      },
    },
  };
}

function identifierNode(
  element: string,
  identifier: PremisIdentifier,
  link?: string | null,
): XmlNode {
  return {
    ...(link ? { _attributes: { simpleLink: link } } : {}),
    [`premis:${element}Type`]: text(identifier.type),
    [`premis:${element}Value`]: text(identifier.value),
  };
}

function vocabularyTerm(
  term: string,
  vocabulary: Set<string>,
  name: string,
): XmlNode {
  return vocabulary.has(term)
    ? {
        _attributes: {
          authority: name,
          authorityURI: `${LOC_VOCABULARY}/${name}`,
        },
        _text: term,
      }
    : text(term);
}

function sameIdentifier(
  a: PremisIdentifier | null | undefined,
  b: PremisIdentifier,
): boolean {
  return !!a && a.type === b.type && a.value === b.value;
}

function text(value: string | number | boolean): XmlNode {
  return { _text: String(value) };
}

// xml-js drops an empty array, so an absent repeated element adds nothing.
function repeated(name: string, nodes: XmlNode[]): XmlNode {
  return nodes.length > 0 ? { [name]: nodes } : {};
}
