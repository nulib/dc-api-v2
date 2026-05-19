const { dcApiEndpoint } = require("../../../environment");
const {
  getTranscriptionContent,
  normalizeLanguages,
} = require("./presentation-api/items");

function annotationMatches(annotation, q) {
  return getTranscriptionContent(annotation)
    .toLowerCase()
    .includes(q.toLowerCase());
}

function buildSearchAnnotationBody(annotation) {
  const body = {
    type: "TextualBody",
    value: getTranscriptionContent(annotation),
    format: "text/plain",
  };
  const languages = normalizeLanguages(annotation.language);
  if (languages.length === 1) {
    body.language = languages[0];
  } else if (languages.length > 1) {
    body.language = languages;
  }
  return body;
}

function transcriptionAnnotationsMatching(annotations = [], q) {
  return annotations
    .filter((annotation) => annotation.type === "transcription")
    .filter((annotation) => annotationMatches(annotation, q));
}

function buildAnnotationTarget(canvasId, workId) {
  const source = { id: canvasId, type: "Canvas" };
  if (workId) {
    source.partOf = [
      {
        id: `${dcApiEndpoint()}/works/${workId}?as=iiif`,
        type: "Manifest",
      },
    ];
  }
  return { type: "SpecificResource", source };
}

module.exports = {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
  transcriptionAnnotationsMatching,
};
