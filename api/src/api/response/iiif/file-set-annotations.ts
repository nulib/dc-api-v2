import { dcApiEndpoint } from "../../../environment.ts";
import {
  buildFileSetAnnotation,
  supportedAnnotations,
} from "./annotation-helpers.ts";
import type { FileSetAnnotation, FileSetSource } from "./types.ts";

export async function transform(response: {
  status: number;
  body: string;
}): Promise<Response> {
  const body = JSON.parse(response.body) as { _source: FileSetSource };
  const fileSet = body._source;
  const annotations: FileSetAnnotation[] = fileSet?.annotations ?? [];

  const annotationPageId = `${dcApiEndpoint()}/file-sets/${fileSet.id}/annotations?as=iiif`;

  const items = supportedAnnotations(annotations).map((annotation) =>
    buildFileSetAnnotation(annotation, fileSet),
  );

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
