const { dcApiEndpoint } = require("../../../environment");
const {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
} = require("./search-helpers");

function transform(annotation, fileSet) {
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const annotationId = `${dcApiEndpoint()}/annotations/${
    annotation.id
  }?as=iiif`;

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: annotationId,
      type: "Annotation",
      // We have hardcoded motivations here, but in the future we may want to make this more dynamic based on the annotation type
      motivation: ["contentState", "commenting"],
      body: buildSearchAnnotationBody(annotation),
      target: buildAnnotationTarget(canvasId, fileSet.work_id),
    }),
  };
}

module.exports = { transform };
