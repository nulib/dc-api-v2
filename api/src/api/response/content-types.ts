import { contentTypeFor } from "./formats.ts";

export const ContentTypes = {
  C2PA_MANIFEST: contentTypeFor("c2pa"),
  JSON: contentTypeFor("opensearch"),
  IIIF_JSON_LD: contentTypeFor("iiif"),
  PREMIS_JSON: contentTypeFor("premisjson"),
  PREMIS_XML: contentTypeFor("premisxml"),
  // OAI-PMH responses aren't negotiated; they're always XML.
  XML: "application/xml; charset=UTF-8",
};
