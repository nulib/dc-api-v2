const { dcApiEndpoint } = require("../../../environment");
const { getWorkFileSets } = require("../../opensearch");
const {
  getTranscriptionContent,
  normalizeLanguages,
} = require("./presentation-api/items");

function buildSearchAnnotationBody(annotation, content) {
  const body = {
    type: "TextualBody",
    value: content,
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

async function transform(workSource, q, opts = {}) {
  const { allowPrivate = false, allowUnpublished = false } = opts;
  const workId = workSource.id;

  const manifestId = `${dcApiEndpoint()}/works/${workId}?as=iiif`;
  const searchId = `${dcApiEndpoint()}/works/${workId}/search?as=iiif&q=${encodeURIComponent(
    q
  )}`;

  // Build canvas index map from the work's file_sets array — same ordering as manifest.js
  const groupIndexMap = {};
  let groupIndex = 0;
  (workSource.file_sets || [])
    .filter((fs) => fs.role === "Access")
    .forEach((fs) => {
      const key = fs.group_with || fs.id;
      if (!(key in groupIndexMap)) {
        groupIndexMap[key] = groupIndex++;
      }
    });

  const response = await getWorkFileSets(workId, {
    allowPrivate,
    allowUnpublished,
    annotationsQuery: q,
    role: "Access",
    source: ["id", "annotations", "group_with"],
  });

  const fileSets =
    response.statusCode === 200
      ? JSON.parse(response.body).hits.hits.map((h) => h._source)
      : [];

  const fileSetGroups = {};
  fileSets.forEach((fs) => {
    const key = fs.group_with || fs.id;
    if (!fileSetGroups[key]) fileSetGroups[key] = [];
    fileSetGroups[key].push(fs);
  });

  const items = [];

  Object.entries(fileSetGroups).forEach(([groupKey, groupFileSets]) => {
    const canvasIndex = groupIndexMap[groupKey];
    if (canvasIndex === undefined) return;
    const canvasId = `${manifestId}/canvas/${canvasIndex}`;

    // Primary file set is the one whose id matches the group key (same as manifest.js)
    const primary =
      groupFileSets.find((fs) => fs.id === groupKey) || groupFileSets[0];
    if (!primary?.annotations) return;

    primary.annotations
      .filter((ann) => ann.type === "transcription")
      .forEach((ann) => {
        const content = getTranscriptionContent(ann);
        if (!content.toLowerCase().includes(q.toLowerCase())) return;

        items.push({
          id: `${canvasId}/annotation/${ann.id}`,
          type: "Annotation",
          motivation: "supplementing",
          body: buildSearchAnnotationBody(ann, content),
          target: canvasId,
        });
      });
  });

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
