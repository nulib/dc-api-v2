import { dcApiEndpoint } from "../../../environment.ts";
import {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
  transcriptionAnnotationsMatching,
} from "./search-helpers.ts";
import type { FileSetSource } from "./types.ts";

export async function transform(
  fileSet: FileSetSource,
  q: string,
): Promise<Response> {
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const searchId = `${dcApiEndpoint()}/file-sets/${fileSet.id}/search?as=iiif&q=${encodeURIComponent(q)}`;

  const items = transcriptionAnnotationsMatching(fileSet.annotations, q).map(
    (ann) => ({
      id: `${dcApiEndpoint()}/annotations/${ann.id}?as=iiif`,
      type: "Annotation",
      motivation: "commenting",
      body: buildSearchAnnotationBody(ann),
      target: buildAnnotationTarget(canvasId, fileSet.work_id),
    }),
  );

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
