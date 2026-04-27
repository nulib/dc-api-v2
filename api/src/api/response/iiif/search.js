const { dcApiEndpoint } = require("../../../environment");
const { getWorkFileSets } = require("../../opensearch");
const {
  getTranscriptionContent,
  normalizeLanguages,
} = require("./presentation-api/items");

function extractSnippet(content, q, contextChars = 100) {
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + q.length + contextChars);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

function buildSearchAnnotationBody(annotation, snippet) {
  const body = {
    type: "TextualBody",
    value: snippet,
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

async function transform(workId, q, opts = {}) {
  const { allowPrivate = false, allowUnpublished = false } = opts;

  const manifestId = `${dcApiEndpoint()}/works/${workId}?as=iiif`;
  const searchId = `${dcApiEndpoint()}/works/${workId}/search?as=iiif&q=${encodeURIComponent(
    q
  )}`;

  const response = await getWorkFileSets(workId, {
    allowPrivate,
    allowUnpublished,
    annotationsQuery: q,
    role: "Access",
    source: ["id", "annotations", "group_with"],
    sortBy: "rank",
  });

  const fileSets =
    response.statusCode === 200
      ? JSON.parse(response.body).hits.hits.map((h) => h._source)
      : [];

  // Replicate manifest.js grouping: ungrouped file sets use their own id as key
  const fileSetGroups = {};
  fileSets.forEach((fs) => {
    const key = fs.group_with || fs.id;
    if (!fileSetGroups[key]) fileSetGroups[key] = [];
    fileSetGroups[key].push(fs);
  });

  const items = [];

  Object.entries(fileSetGroups).forEach(([groupKey, groupFileSets], index) => {
    const canvasId = `${manifestId}/canvas/${index}`;

    // Primary file set is the one whose id matches the group key (same as manifest.js)
    const primary =
      groupFileSets.find((fs) => fs.id === groupKey) || groupFileSets[0];
    if (!primary?.annotations) return;

    primary.annotations
      .filter((ann) => ann.type === "transcription")
      .forEach((ann) => {
        const content = getTranscriptionContent(ann);
        const snippet = extractSnippet(content, q);
        if (!snippet) return;

        items.push({
          id: `${canvasId}/annotation/${ann.id}`,
          type: "Annotation",
          motivation: "supplementing",
          body: buildSearchAnnotationBody(ann, snippet),
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
