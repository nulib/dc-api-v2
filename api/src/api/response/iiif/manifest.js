const { IIIFBuilder } = require("iiif-builder");
const {
  dcApiEndpoint,
  dcUrl,
  openSearchEndpoint,
} = require("../../../environment");
const { transformError } = require("../error");
const { getFileSet } = require("../../opensearch");
const {
  addSupplementingAnnotationToCanvas,
  addTranscriptionAnnotationsToCanvas,
  addThumbnailToCanvas,
  buildAnnotationBody,
  buildImageResourceId,
  buildImageService,
  isAltFormat,
  isAudioVideo,
  isPDF,
  buildSupplementingAnnotation,
} = require("./presentation-api/items");
const { metadataLabelFields } = require("./presentation-api/metadata");
const {
  buildPlaceholderCanvas,
} = require("./presentation-api/placeholder-canvas");
const { nulLogo, provider } = require("./presentation-api/provider");

async function transform(response, options = {}) {
  if (response.statusCode === 200) {
    const builder = new IIIFBuilder();

    const openSearchResponse = JSON.parse(response.body);
    const source = openSearchResponse._source;

    const manifestId = `${dcApiEndpoint()}/works/${source.id}?as=iiif`;

    const transcriptionMap = await fetchFileSetTranscriptions(source, options);
    const transcriptionPages = {};

    const normalizedFlatManifestObj = builder.createManifest(
      manifestId,
      (manifest) => {
        /**
         * Build out canvas from a Work's Fileset
         * @param {object} fileSet
         * @param {number} index
         * @param {boolean} isAuxiliary
         */
        function buildCanvasFromFileSet(fileSet, index, isAuxiliary) {
          const canvasId = `${manifestId}/canvas/${fileSet.role.toLowerCase()}/${index}`;
          manifest.createCanvas(canvasId, (canvas) => {
            if (isAudioVideo(source.work_type))
              canvas.duration = fileSet.duration || 1;

            canvas.height = fileSet.height || 100;
            canvas.width = fileSet.width || 100;

            canvas.addLabel(fileSet.label, "none");
            addThumbnailToCanvas(canvas, fileSet);

            /** Add "painting" annotation */
            const annotationId = `${canvasId}/annotation/0`;
            canvas.createAnnotation(annotationId, {
              id: annotationId,
              type: "Annotation",
              motivation: "painting",
              body: buildAnnotationBody(
                fileSet,
                isAuxiliary ? "Image" : source.work_type
              ),
            });

            /** Add "supplementing" annotation */
            if (!isAuxiliary && fileSet.webvtt) {
              addSupplementingAnnotationToCanvas(canvas, canvasId, fileSet);
            }

            /** Add transcription annotations */
            const transcriptions = transcriptionMap[fileSet.id];
            if (
              source.work_type === "Image" &&
              fileSet.role === "Access" &&
              transcriptions?.length
            ) {
              const pageId = `${canvasId}/annotations/page/0`;
              addTranscriptionAnnotationsToCanvas(
                canvas,
                canvasId,
                transcriptions
              );
              transcriptionPages[pageId] = transcriptions;
            }
          });
        }

        /** Build out manifest descriptive properties */
        manifest.addLabel(source.title || "No title", "none");
        source.description.length > 0 &&
          manifest.addSummary(source.description, "none");

        /** Build metadata property */
        metadataLabelFields(source).forEach((item) => {
          if (item.value && item.value.length > 0) {
            manifest.addMetadata({ none: [item.label] }, { none: item.value });
          }
        });

        /** Add required statement */
        let requiredStatement = [
          "Courtesy of Northwestern University Libraries",
        ];
        manifest.setRequiredStatement({
          label: { none: ["Attribution"] },
          value: {
            none: source.terms_of_use
              ? requiredStatement.concat(source.terms_of_use)
              : requiredStatement,
          },
        });

        /** Add rendering */
        let renderings = [];
        source.file_sets
          .filter((fileSet) => fileSet.role === "Auxiliary")
          .filter((fileSet) => isPDF(fileSet.mime_type))
          .forEach((fileSet) => {
            const rendering = {
              id: fileSet.download_url || null,
              type: "Text",
              label: {
                en: [fileSet.label || "Download PDF"],
              },
              format: "application/pdf",
            };
            renderings.push(rendering);
          });
        manifest.setRendering(renderings);

        /** Add rights using rights statement */
        source.rights_statement?.id &&
          manifest.setRights(source.rights_statement.id);

        /** Add thumbnail */
        const thumbnail = {
          id: source.thumbnail,
          type: "Image",
          width: 300,
          height: 300,
          format: "image/jpeg",
        };
        manifest.addThumbnail(thumbnail);

        /** Add seeAlso reference for api_link */
        const seeAlso = {
          id: source.api_link,
          type: "Dataset",
          format: "application/json",
          label: {
            none: ["Northwestern University Libraries Digital Collections API"],
          },
        };
        manifest.addSeeAlso(seeAlso);

        /** Add homepage */
        const homepage = {
          id: `${dcUrl()}/items/${source.id}`,
          type: "Text",
          format: "text/html",
          label: {
            none: [
              "Homepage at Northwestern University Libraries Digital Collections",
            ],
          },
        };
        manifest.setHomepage(homepage);

        /** Add partOf */
        if (source.collection?.id) {
          const collectionId = source.collection.id;
          const collectionEndpoint = `${dcApiEndpoint()}/collections/${collectionId}`;
          manifest.setPartOf([
            {
              id: `${collectionEndpoint}?as=iiif`,
              type: "Collection",
              label: { none: [source.collection.title] },
              ...(source.collection.description && {
                summary: {
                  none: [source.collection.description],
                },
              }),

              /**
               * TODO: iiif-builder mangles this property, come back to it
               */
              // thumbnail: [
              //   {
              //     id: `${collectionEndpoint}/thumbnail`,
              //     type: "Image",
              //     width: 300,
              //     height: 300,
              //     format: "image/jpeg",
              //   },
              // ],

              /**
               * TODO: iiif-builder cleanses this property and doesn't include it.
               * Come back to it.
               */
              homepage: [
                {
                  id: `${dcUrl()}/collections/${collectionId}`,
                  type: "Text",
                  format: "text/html",
                  label: {
                    none: [
                      "Homepage at Northwestern University Libraries Digital Collections",
                    ],
                  },
                },
              ],
            },
          ]);
        }

        /** Add items (Canvases) from a Work's Filesets */

        /** Access file sets */
        /** Group file sets by `group_with` field */
        const fileSetGroups = {};
        source.file_sets
          .filter((fileSet) => fileSet.role === "Access")
          .forEach((fileSet) => {
            if (fileSet.group_with) {
              if (!fileSetGroups[fileSet.group_with]) {
                fileSetGroups[fileSet.group_with] = [];
              }
              fileSetGroups[fileSet.group_with].push(fileSet);
            } else {
              if (!fileSetGroups[fileSet.id]) {
                fileSetGroups[fileSet.id] = [];
              }
              fileSetGroups[fileSet.id].push(fileSet);
            }
          });

        /** Process grouped file sets */
        Object.entries(fileSetGroups).forEach(
          ([currentGroupKey, fileSets], index) => {
            const canvasId = `${manifestId}/canvas/${index}`;
            manifest.createCanvas(canvasId, (canvas) => {
              // Find the file set with ID matching the currentGroupKey and make it primary
              let matchingFileSetIndex = -1;
              for (let i = 0; i < fileSets.length; i++) {
                if (fileSets[i].id === currentGroupKey) {
                  matchingFileSetIndex = i;
                  break;
                }
              }
              if (matchingFileSetIndex > -1) {
                // Remove the matching fileSet and place it at the beginning
                const matchingFileSet = fileSets.splice(
                  matchingFileSetIndex,
                  1
                )[0];
                fileSets.unshift(matchingFileSet);
              }
              const primaryFileSet = fileSets[0];

              if (isAudioVideo(source.work_type)) {
                canvas.duration = primaryFileSet.duration || 1;
              }
              canvas.height = primaryFileSet.height || 100;
              canvas.width = primaryFileSet.width || 100;
              canvas.addLabel(primaryFileSet.label, "none");
              addThumbnailToCanvas(canvas, primaryFileSet);

              /** Build "Choice" annotation if there are alternates */
              const annotationId = `${canvasId}/annotation/0`;
              const choiceBody =
                fileSets.length > 1
                  ? {
                      type: "Choice",
                      items: fileSets.map((fileSet) =>
                        buildAnnotationBody(fileSet, source.work_type)
                      ),
                    }
                  : buildAnnotationBody(primaryFileSet, source.work_type);

              canvas.createAnnotation(annotationId, {
                id: annotationId,
                type: "Annotation",
                motivation: "painting",
                body: choiceBody,
              });

              /** Add "supplementing" annotation */
              if (primaryFileSet.webvtt) {
                addSupplementingAnnotationToCanvas(
                  canvas,
                  canvasId,
                  primaryFileSet
                );
              }

              /** Add transcription annotations */
              const transcriptions = transcriptionMap[primaryFileSet.id];
              if (
                source.work_type === "Image" &&
                primaryFileSet.role === "Access" &&
                transcriptions?.length
              ) {
                const pageId = `${canvasId}/annotations/page/0`;
                addTranscriptionAnnotationsToCanvas(
                  canvas,
                  canvasId,
                  transcriptions
                );
                transcriptionPages[pageId] = transcriptions;
              }
            });
          }
        );

        source.file_sets
          .filter((fileSet) => fileSet.role === "Auxiliary")
          .filter((fileSet) => !isAltFormat(fileSet.mime_type))
          .forEach((fileSet, index) => {
            buildCanvasFromFileSet(fileSet, index, true);
          });

        if (source.behavior) {
          manifest.addBehavior(source.behavior.toLowerCase());
        }
      }
    );

    const jsonManifest = builder.toPresentation3({
      id: normalizedFlatManifestObj.id,
      type: "Manifest",
    });

    /**
     * Add a placeholderCanvas property to a Canvas if the annotation body is of type "Image"
     * (iiif-builder package currently doesn't support adding this property)
     */
    for (let i = 0; i < jsonManifest.items.length; i++) {
      if (jsonManifest.items[i]?.items[0]?.items[0]?.body.type === "Image") {
        const { id, thumbnail } = jsonManifest.items[i];
        if (thumbnail) {
          const placeholderFileSet = source.file_sets.find(
            (fileSet) =>
              fileSet.representative_image_url ===
              thumbnail[0].service[0]["@id"]
          );

          // only add the placeholderCanvas property if the fileSet has width and height
          if (placeholderFileSet.width && placeholderFileSet.height) {
            jsonManifest.items[i].placeholderCanvas = buildPlaceholderCanvas(
              id,
              placeholderFileSet
            );
          }
        }
      }

      /** Re-do transcription text in annotation bodies as it's getting stripped somehow */
      const annotationPages = jsonManifest.items[i]?.annotations || [];
      annotationPages.forEach((page) => {
        const pageTranscriptions = transcriptionPages[page.id];
        if (!pageTranscriptions?.length) return;
        page.items?.forEach((annotation, idx) => {
          const sourceTranscription = pageTranscriptions[idx];
          if (!sourceTranscription) return;
          if (!annotation.body) annotation.body = {};
          annotation.body.value = getTranscriptionContent(sourceTranscription);
        });
      });
    }

    jsonManifest.provider = [provider];
    jsonManifest.logo = [nulLogo];

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...jsonManifest,
      }),
    };
  }
  return transformError(response);
}

async function fetchFileSetTranscriptions(source, options) {
  if (source.work_type !== "Image") return {};
  if (!openSearchEndpoint()) return {};

  const candidates = (source.file_sets || []).filter(
    (file_set) => file_set.role === "Access" && file_set.id
  );

  const allowPrivate = options.allowPrivate || false;
  const allowUnpublished = options.allowUnpublished || false;

  const results = await Promise.all(
    candidates.map(async (file_set) => {
      const response = await getFileSet(file_set.id, {
        allowPrivate,
        allowUnpublished,
      });
      if (response.statusCode !== 200) return null;
      const body = JSON.parse(response.body);
      const annotations =
        body?._source?.annotations?.filter(
          (annotation) => annotation.type === "transcription"
        ) || [];
      if (annotations.length === 0) return null;
      return { id: file_set.id, annotations };
    })
  );

  return results
    .filter(Boolean)
    .reduce((acc, { id, annotations }) => ({ ...acc, [id]: annotations }), {});
}

function getTranscriptionContent(annotation = {}) {
  const value = annotation.content ?? "";
  return typeof value === "string" ? value : "";
}

module.exports = { transform };
