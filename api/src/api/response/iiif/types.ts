export interface LabeledEntity {
  label: string;
}

export interface LabeledRole {
  label_with_role: string;
}

export interface NavPlace {
  id?: string;
  coordinates: [number, number];
  label: string;
  summary?: string;
}

export interface FileSetAnnotation {
  id?: string;
  type: string;
  content?: string;
  language?: string | string[];
}

export interface FileSetSource {
  id: string;
  label?: string;
  original_filename?: string;
  accession_number?: string;
  mime_type: string;
  role: "Access" | "Auxiliary" | "Preservation";
  width?: number;
  height?: number;
  duration?: number;
  representative_image_url?: string;
  streaming_url?: string;
  download_url?: string;
  api_link?: string;
  webvtt?: string;
  group_with?: string;
  work_id?: string;
  work_title?: string;
  description?: string;
  extracted_metadata?: {
    exif?: { value?: { imageWidth?: number; imageHeight?: number } };
  };
  annotations?: FileSetAnnotation[];
}

export interface CollectionSource {
  id: string;
  title?: string;
  representative_image?: { url?: string };
}

export interface WorkSource {
  id: string;
  title: string;
  representative_file_set?: { url?: string };
  description: string[];
  work_type: string;
  behavior?: string;
  terms_of_use?: string;
  thumbnail?: string;
  api_link?: string;
  file_sets: FileSetSource[];
  rights_statement?: { id?: string; label?: string };
  collection?: { id?: string; title?: string; description?: string };
  navPlace?: NavPlace[];
  nav_place?: NavPlace[];
  // Metadata display fields
  alternate_title?: string[];
  abstract?: string[];
  caption?: string[];
  contributor: LabeledRole[];
  creator: LabeledEntity[];
  cultural_context?: string[];
  date_created?: string[];
  library_unit?: string;
  physical_description_size?: string[];
  genre: LabeledEntity[];
  identifier?: string[];
  modified_date?: string;
  language: LabeledEntity[];
  license?: { label?: string };
  location?: LabeledEntity[];
  physical_description_material?: string[];
  notes: Array<{ note: string; type: string }>;
  provenance?: string[];
  publisher?: string[];
  related_material?: string[];
  related_url: Array<{ url: string; label: string }>;
  rights_holder?: string[];
  scope_and_contents?: string[];
  series?: string[];
  source?: string[];
  style_period: LabeledEntity[];
  subject: LabeledEntity[];
  table_of_contents?: string[];
  technique: LabeledEntity[];
}

export interface WorkSummarySource {
  id: string;
  title?: string;
  work_type?: string;
  thumbnail?: string;
  api_link?: string;
  iiif_manifest?: string;
  description?: string;
  canonical_link?: string;
  navPlace?: NavPlace[];
  nav_place?: NavPlace[];
}
