import { dcApiEndpoint } from "../../../environment.ts";
import { getWorkFileSets } from "../../opensearch.ts";
import {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
  transcriptionAnnotationsMatching,
} from "./search-helpers.ts";
import type { FileSetSource, WorkSource } from "./types.ts";
import type { OpenSearchSearchResponse } from "../../opensearch-types.ts";

type FileSetsSearchSource = Pick<
  FileSetSource,
  "id" | "annotations" | "group_with"
>;

export async function transform(
  workSource: WorkSource,
  q: string,
  opts: { allowPrivate?: boolean; allowUnpublished?: boolean } = {},
): Promise<Response> {
  const { allowPrivate = false, allowUnpublished = false } = opts;
  const workId = workSource.id;

  const searchId = `${dcApiEndpoint()}/works/${workId}/search?as=iiif&q=${encodeURIComponent(q)}`;

  // Build canvas ID map from the work's file_sets array using the same grouping
  // and primary-file-set selection as manifest.ts.
  const groupFileSetMap: Record<string, FileSetSource[]> = {};
  (workSource.file_sets || [])
    .filter((fs) => fs.role === "Access")
    .forEach((fs) => {
      const key = fs.group_with || fs.id;
      if (!groupFileSetMap[key]) groupFileSetMap[key] = [];
      groupFileSetMap[key].push(fs);
    });
  const groupCanvasIdMap: Record<string, string> = Object.fromEntries(
    Object.entries(groupFileSetMap).map(([key, groupFileSets]) => {
      const primary =
        groupFileSets.find((fs) => fs.id === key) || groupFileSets[0];
      return [key, `${dcApiEndpoint()}/file-sets/${primary.id}?as=iiif`];
    }),
  );

  const response = await getWorkFileSets(workId, {
    allowPrivate,
    allowUnpublished,
    annotationsQuery: q,
    role: "Access",
    source: ["id", "annotations", "group_with"],
  });

  const fileSets: FileSetsSearchSource[] =
    response.status === 200
      ? (
          JSON.parse(
            response.body,
          ) as OpenSearchSearchResponse<FileSetsSearchSource>
        ).hits.hits.map((h) => h._source)
      : [];

  const fileSetGroups: Record<string, FileSetsSearchSource[]> = {};
  fileSets.forEach((fs) => {
    const key = fs.group_with || fs.id;
    if (!fileSetGroups[key]) fileSetGroups[key] = [];
    fileSetGroups[key].push(fs);
  });

  const items: Record<string, unknown>[] = [];

  Object.entries(fileSetGroups).forEach(([groupKey, groupFileSets]) => {
    const canvasId = groupCanvasIdMap[groupKey];
    if (canvasId === undefined) return;

    const primary =
      groupFileSets.find((fs) => fs.id === groupKey) || groupFileSets[0];
    if (!primary?.annotations?.length) return;

    transcriptionAnnotationsMatching(primary.annotations, q).forEach((ann) => {
      items.push({
        id: `${dcApiEndpoint()}/annotations/${ann.id}?as=iiif`,
        type: "Annotation",
        motivation: "commenting",
        body: buildSearchAnnotationBody(ann),
        target: buildAnnotationTarget(canvasId, workId),
      });
    });
  });

  return new Response(
    JSON.stringify({
      "@context": "http://iiif.io/api/search/2/context.json",
      id: searchId,
      type: "AnnotationPage",
      items,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
