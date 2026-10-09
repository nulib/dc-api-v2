import { appInfo, dcApiEndpoint } from "../../../environment.ts";
import { C2paUnavailableError, signManifest } from "../../c2pa.ts";
import { transformError } from "../error.ts";
import { documentBody } from "../opensearch/index.ts";
import type { OpenSearchGetResponse } from "../../opensearch-types.ts";
import type {
  C2paAction,
  C2paExport,
  C2paIngredient,
  ProvenanceWorkSource,
} from "./types.ts";
import Honeybadger from "@honeybadger-io/js";
import PackageInfo from "../../../../package.json" with { type: "json" };

export const MANIFEST_MEDIA_TYPE = "application/c2pa";
const ASSET_MEDIA_TYPE = "application/json";

// The record is assembled from repository data by software. Meadow overrides
// this when any of the record's live content is AI-generated.
const DEFAULT_DIGITAL_SOURCE_TYPE =
  "http://cv.iptc.org/newscodes/digitalsourcetype/dataDrivenMedia";

/**
 * A C2PA Manifest Store for a work's metadata record.
 *
 * The asset the manifest is bound to is the body of the default work response
 * (`GET /works/{id}`), byte for byte, so a validator needs both. The manifest
 * is signed on request and is detached, since JSON has nowhere to embed one,
 * and is served as `application/c2pa` (C2PA 11.4).
 *
 * Where signing isn't configured, the manifest definition is returned as JSON
 * instead, marked as unsigned. That is a description of what would be signed,
 * not a Content Credential.
 */
export async function transform(response: {
  status: number;
  body: string;
}): Promise<Response> {
  if (response.status !== 200) return transformError(response);

  const source = (
    JSON.parse(response.body) as OpenSearchGetResponse<ProvenanceWorkSource>
  )._source!;
  const definition = manifestDefinition(source);

  try {
    const manifest = await signManifest(definition, {
      buffer: Buffer.from(documentBody(source)),
      mimeType: ASSET_MEDIA_TYPE,
    });
    return new Response(new Uint8Array(manifest), {
      status: 200,
      headers: {
        "content-type": MANIFEST_MEDIA_TYPE,
        // Browsers save the response; give it the name a validator looks for.
        "content-disposition": `attachment; filename="${source.id}.c2pa"`,
        link: `<${workLink(source)}>; rel="describes"`,
      },
    });
  } catch (err) {
    if (err instanceof C2paUnavailableError) {
      return unsignedResponse(definition, err.message);
    }
    // Signing was attempted and failed (a bad credential, an unreachable
    // time-stamp authority). An unsigned stand-in would be indistinguishable
    // from an environment that never signs, so fail instead.
    console.error("C2PA signing failed", err);
    Honeybadger.notify(err as Error);
    return transformError({ status: 503 });
  }
}

/** The `Link` header value that points a validator at a work's manifest. */
export function manifestLink(source: ProvenanceWorkSource): string {
  return `<${workLink(source)}?as=c2pa>; rel="c2pa-manifest"`;
}

function workLink(source: ProvenanceWorkSource): string {
  return source.api_link ?? `${dcApiEndpoint()}/works/${source.id}`;
}

function unsignedResponse(
  definition: Record<string, unknown>,
  reason: string,
): Response {
  const body = JSON.stringify({
    data: definition,
    info: { ...appInfo(), c2pa: { signed: false, reason } },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** A c2pa-rs manifest definition for the work's metadata record. */
export function manifestDefinition(
  source: ProvenanceWorkSource,
): Record<string, unknown> {
  const provenance: Partial<C2paExport> =
    source.ai_provenance_exports?.c2pa ?? {};
  const ingredients = provenance.ingredients ?? [];
  const ingredientIds = new Set(ingredients.map(({ id }) => id));

  return {
    title: source.title || `Work ${source.id}`,
    format: ASSET_MEDIA_TYPE,
    claim_generator_info: [
      { name: PackageInfo.name, version: PackageInfo.version },
    ],
    ingredients: ingredients.map(ingredient),
    assertions: [
      {
        label: "c2pa.actions.v2",
        data: {
          actions: [
            createdAction(provenance),
            ...(provenance.actions ?? []).map((entry) =>
              action(entry, ingredientIds),
            ),
          ],
          // Only AI-related changes are recorded; a record's ordinary
          // cataloging history is not.
          allActionsIncluded: false,
        },
      },
      ...(provenance.ai_disclosures ?? []).map((data) => ({
        label: "c2pa.ai-disclosure",
        data,
      })),
      {
        label: "c2pa.asset-ref",
        data: {
          references: [
            {
              reference: { uri: workLink(source) },
              description: "The metadata record this manifest is bound to",
            },
          ],
        },
      },
    ],
  };
}

// A standard manifest opens with exactly one c2pa.created (or c2pa.opened)
// action carrying the digitalSourceType of the asset as a whole (C2PA
// 18.15.2). The asset is the serialized record, which this API creates.
function createdAction(provenance: Partial<C2paExport>): C2paAction {
  return {
    action: "c2pa.created",
    softwareAgent: { name: PackageInfo.name, version: PackageInfo.version },
    digitalSourceType:
      provenance.digital_source_type || DEFAULT_DIGITAL_SOURCE_TYPE,
    description: PackageInfo.description,
  };
}

// `ingredientIds` are resolved to hashed ingredient references by c2pa-rs,
// which rejects an id it can't find.
function action(entry: C2paAction, ingredientIds: Set<string>): C2paAction {
  const { ingredientIds: ids, ...parameters } = entry.parameters ?? {};
  const known = (ids ?? []).filter((id) => ingredientIds.has(id));
  return {
    ...entry,
    parameters: {
      ...parameters,
      ...(known.length > 0 ? { ingredientIds: known } : {}),
    },
  };
}

// Meadow names ingredient fields as the specification does; c2pa-rs has its
// own names for the same things.
function ingredient(entry: C2paIngredient): Record<string, unknown> {
  return {
    label: entry.id,
    title: entry["dc:title"] ?? entry.id,
    relationship: entry.relationship,
    ...(entry["dc:format"] ? { format: entry["dc:format"] } : {}),
    ...(entry.instanceID ? { instance_id: entry.instanceID } : {}),
    ...(entry.informationalURI
      ? { informational_URI: entry.informationalURI }
      : {}),
    ...(entry.description ? { description: entry.description } : {}),
  };
}
