const { dcApiEndpoint } = require("../../../environment");

async function transform(response) {
  const body = JSON.parse(response.body);
  const fileSet = body._source;
  const annotations = fileSet?.annotations ?? [];

  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const annotationPageId = `${dcApiEndpoint()}/file-sets/${
    fileSet.id
  }/annotations?as=iiif`;

  // Build annotation items - filter for transcriptions only
  // We currently will only have one annotation and it's a transcription
  const items = annotations
    .filter((annotation) => annotation.type === "transcription")
    .map((annotation, idx) => {
      const annotationId = `${annotationPageId}/a${idx}`;
      return {
        id: annotationId,
        type: "Annotation",
        motivation: "commenting",
        body: {
          type: "TextualBody",
          value: annotation.content,
          format: "text/plain",
          language: annotation.language || "en",
        },
        target: canvasId,
      };
    });

  const annotationPage = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: annotationPageId,
    type: "AnnotationPage",
    items: items,
  };

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(annotationPage),
  };
}

module.exports = { transform };
