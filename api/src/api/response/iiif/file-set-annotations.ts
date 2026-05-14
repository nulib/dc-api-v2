import { dcApiEndpoint } from "../../../environment.ts";
import {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
} from "./search-helpers.ts";
import type { FileSetAnnotation, FileSetSource } from "./types.ts";

export async function transform(response: {
  status: number;
  body: string;
}): Promise<Response> {
  const body = JSON.parse(response.body) as { _source: FileSetSource };
  const fileSet = body._source;
  const annotations: FileSetAnnotation[] = fileSet?.annotations ?? [];

  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const annotationPageId = `${dcApiEndpoint()}/file-sets/${fileSet.id}/annotations?as=iiif`;

  const items = annotations
    .filter((annotation) => annotation.type === "transcription")
    .map((annotation) => {
      const annotationId = `${dcApiEndpoint()}/annotations/${annotation.id}?as=iiif`;
      return {
        id: annotationId,
        type: "Annotation",
        motivation: "commenting",
        body: buildSearchAnnotationBody(annotation),
        target: buildAnnotationTarget(canvasId, fileSet.work_id),
      };
    });

  return new Response(
    JSON.stringify({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: annotationPageId,
      type: "AnnotationPage",
      items,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
