/**
 * Standards-shaped projections of a work's AI provenance, built and indexed
 * by Meadow (see Meadow.AI.Provenance.Export) as `ai_provenance_exports`.
 */
export interface C2paAction {
  action: string;
  when?: string;
  softwareAgent?: { name: string; version?: string };
  digitalSourceType?: string;
  description?: string;
  parameters?: Record<string, unknown> & { ingredientIds?: string[] };
}

export interface C2paIngredient {
  id: string;
  "dc:title"?: string;
  "dc:format"?: string;
  relationship: string;
  instanceID?: string;
  informationalURI?: string;
  description?: string;
}

export interface C2paExport {
  standard: "C2PA";
  spec_version: string;
  digital_source_type?: string | null;
  actions?: C2paAction[];
  ai_disclosures?: Record<string, unknown>[];
  ingredients?: C2paIngredient[];
}

export interface PremisIdentifier {
  type: string;
  value: string;
}

export interface PremisObject {
  identifier: PremisIdentifier;
  category?: string | null;
  role?: string | null;
  type?: string | null;
  work_id?: string | null;
  file_set_id?: string | null;
  target_id?: string | null;
  field_path?: string | null;
  access_link?: string | null;
  restricted?: boolean | null;
  fixity?: {
    message_digest_algorithm?: string | null;
    message_digest?: string | null;
  } | null;
}

export interface PremisEvent {
  identifier: PremisIdentifier;
  type: string;
  date_time: string;
  outcome?: string | null;
  outcome_detail?: string | null;
  activity_id?: string | null;
  target?: PremisIdentifier | null;
  linking_agents?: {
    role?: string | null;
    agent_identifier?: PremisIdentifier | null;
  }[];
}

export interface PremisAgent {
  identifier: PremisIdentifier;
  type?: string | null;
  name?: string | null;
  version?: string | null;
}

export interface PremisRights {
  basis: string;
  policy?: string | null;
  activity_id?: string | null;
  note?: string | null;
}

export interface PremisExport {
  premis_version: string;
  scope: { work_id: string };
  objects: PremisObject[];
  events: PremisEvent[];
  agents: PremisAgent[];
  rights: PremisRights[];
}

export interface ProvenanceWorkSource {
  id: string;
  title?: string | null;
  api_link?: string;
  file_sets?: { id: string; mime_type?: string | null }[] | null;
  ai_provenance_exports?: {
    c2pa?: C2paExport;
    premis?: PremisExport;
  } | null;
}
