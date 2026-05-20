import { dcApiEndpoint } from "../../../environment.ts";
import {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
} from "./search-helpers.ts";
import type { FileSetAnnotation, FileSetSource } from "./types.ts";

export function transform(
  annotation: FileSetAnnotation,
  fileSet: FileSetSource,
): Response {
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const annotationId = `${dcApiEndpoint()}/annotations/${annotation.id}?as=iiif`;

  return new Response(
    JSON.stringify({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: annotationId,
      type: "Annotation",
      motivation: ["contentState", "commenting"],
      body: buildSearchAnnotationBody(annotation),
      target: buildAnnotationTarget(canvasId, fileSet.work_id),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
