const { dcApiEndpoint } = require("../../../environment");
const {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
  transcriptionAnnotationsMatching,
} = require("./search-helpers");

async function transform(fileSet, q) {
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const searchId = `${dcApiEndpoint()}/file-sets/${
    fileSet.id
  }/search?as=iiif&q=${encodeURIComponent(q)}`;

  const items = transcriptionAnnotationsMatching(fileSet.annotations, q).map(
    (ann) => ({
      id: `${dcApiEndpoint()}/annotations/${ann.id}?as=iiif`,
      type: "Annotation",
      motivation: "commenting",
      body: buildSearchAnnotationBody(ann),
      target: buildAnnotationTarget(canvasId, fileSet.work_id),
    })
  );

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      "@context": "http://iiif.io/api/search/2/context.json",
      id: searchId,
      type: "AnnotationPage",
      items,
    }),
  };
}

module.exports = { transform };
