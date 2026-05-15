const { dcApiEndpoint } = require("../../../environment");
const {
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
      id: `${canvasId}/annotation/${ann.id}`,
      type: "Annotation",
      motivation: "supplementing",
      body: buildSearchAnnotationBody(ann),
      target: canvasId,
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
