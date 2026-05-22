import type { FileSetData, WorkData, SingleItem, DataContainer } from "./types";
import { fileSetsToKml } from "./kml";
import type {
  OpenSearchSearchResponse,
  OpenSearchGetResponse,
  OpenSearchHit,
} from "../../opensearch-types.ts";

function collectFileSets({ data }: DataContainer): FileSetData[] {
  const items = Array.isArray(data) ? data : [data];

  return items
    .flatMap((item: WorkData | FileSetData) => {
      switch (item.api_model) {
        case "FileSet":
          return [item];
        case "Work":
          return (item.file_sets ?? []).map((fs: FileSetData) => ({
            ...fs,
            label: `${item.title}: ${fs.label}`,
          }));
        default:
          return [];
      }
    })
    .filter(hasGeoreferenceAnnotation);
}

function hasGeoreferenceAnnotation(fileSet: FileSetData): boolean {
  return (
    fileSet.annotations?.some(
      (annotation) =>
        annotation.type === "georeference" && annotation.content !== null,
    ) || false
  );
}

function deriveTitle({ data }: DataContainer): string {
  if (Array.isArray(data)) {
    if (data.length > 1) {
      return "Multiple Items";
    }
    data = data[0];
  }

  const item = data as SingleItem;
  switch (item.api_model) {
    case "Work":
      return item.title || "Untitled Work";
    case "FileSet":
      return `${item.work_title}: ${item.label}`;
    default:
      return "KML Export";
  }
}

function toKML(input: DataContainer): string {
  const fileSets = collectFileSets(input);
  const title = deriveTitle(input);
  return fileSetsToKml(fileSets, title);
}

export function transform(
  response: OpenSearchSearchResponse | OpenSearchGetResponse,
): Response {
  const data = (response as OpenSearchSearchResponse)?.hits?.hits
    ? (response as OpenSearchSearchResponse).hits.hits.map(
        (hit: OpenSearchHit) => hit._source,
      )
    : (response as OpenSearchGetResponse)._source;
  const kml = toKML({ data } as DataContainer);
  return new Response(kml, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml",
    },
  });
}
