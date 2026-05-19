const { dcApiEndpoint } = require("../../../environment");
const { getWorkFileSets } = require("../../opensearch");
const {
  buildAnnotationTarget,
  buildSearchAnnotationBody,
  transcriptionAnnotationsMatching,
} = require("./search-helpers");

async function transform(workSource, q, opts = {}) {
  const { allowPrivate = false, allowUnpublished = false } = opts;
  const workId = workSource.id;

  const searchId = `${dcApiEndpoint()}/works/${workId}/search?as=iiif&q=${encodeURIComponent(
    q
  )}`;

  // Build canvas ID map from the work's file_sets array using the same grouping
  // and primary-file-set selection as manifest.js.
  const groupFileSetMap = {};
  (workSource.file_sets || [])
    .filter((fs) => fs.role === "Access")
    .forEach((fs) => {
      const key = fs.group_with || fs.id;
      if (!groupFileSetMap[key]) {
        groupFileSetMap[key] = [];
      }
      groupFileSetMap[key].push(fs);
    });
  const groupCanvasIdMap = Object.fromEntries(
    Object.entries(groupFileSetMap).map(([key, groupFileSets]) => {
      const primary =
        groupFileSets.find((fs) => fs.id === key) || groupFileSets[0];
      return [key, `${dcApiEndpoint()}/file-sets/${primary.id}?as=iiif`];
    })
  );

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
    const canvasId = groupCanvasIdMap[groupKey];
    if (canvasId === undefined) return;

    // Primary file set is the one whose id matches the group key (same as manifest.js)
    const primary =
      groupFileSets.find((fs) => fs.id === groupKey) || groupFileSets[0];
    if (!primary?.annotations) return;

    transcriptionAnnotationsMatching(primary.annotations, q).forEach((ann) => {
      items.push({
        id: `${dcApiEndpoint()}/annotations/${ann.id}?as=iiif`,
        type: "Annotation",
        motivation: "commenting",
        body: buildSearchAnnotationBody(ann),
        target: buildAnnotationTarget(canvasId, workId),
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
