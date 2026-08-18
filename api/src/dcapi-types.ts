// Friendly names for the schema types generated from
// docs/docs/spec/data-types.yaml (see the schemas script in package.json),
// mirroring the exports of the published @nulib/dcapi-types package. The API
// consumes its own generated types directly so it never lags behind the spec;
// the npm package is published (by the *-types workflows) for external
// consumers only.

import type { components } from "../schemas.ts";

export type Collection = components["schemas"]["Collection"];
export type CollectionRepresentativeImage =
  components["schemas"]["CollectionRepresentativeImage"];
export type ControlledTerm = components["schemas"]["ControlledTerm"];
export type ControlledTermWithRole =
  components["schemas"]["ControlledTermWithRole"];
export type FileSet = components["schemas"]["FileSet"];
export type FileSetBase = components["schemas"]["FileSetBase"];
export type FileSetRole = components["schemas"]["FileSetRole"];
export type LibraryUnit = components["schemas"]["LibraryUnit"];
export type NoteType = components["schemas"]["NoteType"];
export type PaginationInfo = components["schemas"]["PaginationInfo"];
export type PreservationLevel = components["schemas"]["PreservationLevel"];
export type RelatedUrlLabel = components["schemas"]["RelatedUrlLabel"];
export type RepresentativeFileSet =
  components["schemas"]["RepresentativeFileSet"];
export type Status = components["schemas"]["Status"];
export type Visibility = components["schemas"]["Visibility"];
export type Work = components["schemas"]["Work"];
export type WorkType = components["schemas"]["WorkType"];
