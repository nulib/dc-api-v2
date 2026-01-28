const { dcApiEndpoint } = require("../../../environment");
const { getWorkFileSets } = require("../../opensearch");

async function transform(response, options = {}) {
  const body = JSON.parse(response.body);
  const fileSet = body._source;
  const annotations = fileSet?.annotations ?? [];

  const workId = fileSet.work_id;
  const fileSetId = body._id;
  const fileSetIndex = await getFileSetIndex(workId, fileSetId, options);

  const canvasId = `${dcApiEndpoint()}/works/${workId}?as=iiif/canvas/${fileSetIndex}`;
  const annotationPageId = `${dcApiEndpoint()}/file-sets/${fileSet.id}/annotations?as=iiif`;

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

async function getFileSetIndex(workId, fileSetId, options)  {
  const fileSetsResponse = await getWorkFileSets(workId, {
    allowPrivate: options.allowPrivate,
    allowUnpublished: options.allowUnpublished,
    role: "Access", 
    sortBy: "rank",
  });

  const fileSetBody = JSON.parse(fileSetsResponse.body);
  const hits = fileSetBody?.hits?.hits || [];

  const index = hits.findIndex(hit => hit._source.id === fileSetId);

  return index;
}
module.exports = { transform };
