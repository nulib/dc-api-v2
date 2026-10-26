type ProvenanceSummary = Record<string, unknown>;

interface Provenanced {
  ai_provenance?: ProvenanceSummary | null;
  annotations?: Provenanced[] | null;
}

/** How staff are named in anything this API publishes: collectively. */
export const STAFF_LABEL = "Northwestern University Libraries staff";

// Fields of an `ai_provenance` entry that name a staff member.
const STAFF_FIELDS = ["reviewer"];

/**
 * Credits staff collectively wherever a document names one of them.
 *
 * Meadow now indexes the reviewer of an AI-assisted field as STAFF_LABEL, but
 * documents indexed before it did still carry the reviewer's own name, on the
 * document itself and on a file set's annotations. Returns the document
 * unchanged (the same object) when it has no AI provenance.
 */
export function generalizeStaff<T>(source: T): T {
  if (!source || typeof source !== "object") return source;
  const doc = source as Provenanced;
  const generalized: Provenanced = {};

  if (doc.ai_provenance && typeof doc.ai_provenance === "object") {
    generalized.ai_provenance = generalizeSummary(doc.ai_provenance);
  }
  if (Array.isArray(doc.annotations)) {
    generalized.annotations = doc.annotations.map(generalizeStaff);
  }

  return Object.keys(generalized).length > 0
    ? ({ ...source, ...generalized } as T)
    : source;
}

// Entries are keyed by field path, which reaches the index as nested objects
// (`descriptive_metadata` > `subject`) rather than one dotted key, so a staff
// field can sit at any depth.
function generalizeSummary(summary: ProvenanceSummary): ProvenanceSummary {
  return Object.fromEntries(
    Object.entries(summary).map(([key, value]) => {
      if (STAFF_FIELDS.includes(key)) return [key, value ? STAFF_LABEL : value];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, generalizeSummary(value as ProvenanceSummary)];
      }
      return [key, value];
    }),
  );
}
