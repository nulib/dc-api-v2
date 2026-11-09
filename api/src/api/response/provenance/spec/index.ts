import { dcApiEndpoint } from "../../../../environment.ts";
import schema from "./schema-0.json" with { type: "json" };
import context from "./context.json" with { type: "json" };

// The documents write this API's base as `{api}`, so each environment serves,
// and validates against, its own.
function forEndpoint<T>(document: T): T {
  return JSON.parse(
    JSON.stringify(document).replaceAll("{api}", dcApiEndpoint()),
  );
}

/** The JSON Schema of the profile a ProvenanceService names. */
export function provenanceSchema(): Record<string, unknown> {
  return forEndpoint(schema);
}

/** The JSON-LD context for the terms the profile adds. */
export function provenanceContextDocument(): Record<string, unknown> {
  return forEndpoint(context);
}
