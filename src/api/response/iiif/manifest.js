const { IIIFBuilder } = require("iiif-builder");
const { dcApiEndpoint, dcUrl } = require("../../../environment");
const { transformError } = require("../error");
const {
  buildAnnotationBody,
  buildImageResourceId,
  buildImageService,
  isAudioVideo,
} = require("./presentation-api/items");
const { metadataLabelFields } = require("./presentation-api/metadata");

function transform(response) {
  if (response.statusCode === 200) {
    const builder = new IIIFBuilder();
    const openSearchResponse = JSON.parse(response.body);
    const source = openSearchResponse._source;

    const manifestId = `${dcApiEndpoint()}/works/${source.id}?as=iiif`;

    const annotationsToTagOnAtEnd = [];

    const normalizedFlatManifestObj = builder.createManifest(
      manifestId,
      (manifest) => {
        function buildCanvasFromFileSet(fileSet, index, isAuxiliary) {
          const canvasId = `${manifestId}/canvas/${fileSet.role.toLowerCase()}/${index}`;
          manifest.createCanvas(canvasId, (canvas) => {
            if (isAudioVideo(source.work_type))
              canvas.duration = fileSet.duration || 1;

            canvas.height = fileSet.height || 100;
            canvas.width = fileSet.width || 100;

            canvas.addLabel(fileSet.label, "none");

            /** Add thumbnail for Canvas */
            if (fileSet.representative_image_url) {
              const canvasThumbnail = {
                id: buildImageResourceId(fileSet.representative_image_url),
                type: "Image",
                width: 300,
                height: 300,
                format: "image/jpeg",
                service: buildImageService(fileSet.representative_image_url),
              };
              canvas.addThumbnail(canvasThumbnail);
            }

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

            if (!isAuxiliary && fileSet.webvtt) {
              const annotations = {
                id: `${canvasId}/annotations/page/0`,
                type: "AnnotationPage",
                items: [
                  {
                    id: `${canvasId}/annotations/page/0/a0`,
                    type: "Annotation",
                    motivation: "supplementing",
                    body: {
                      id: fileSet.webvtt,
                      type: "Text",
                      format: "text/vtt",
                      label: {
                        en: ["Chapters"],
                      },
                      language: "none",
                    },
                    target: canvasId,
                  },
                ],
              };
              annotationsToTagOnAtEnd.push(annotations);
            }
          });
        }

        /** Build out manifest descriptive properties */
        manifest.addLabel(source.title, "none");
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
        const collectionEndpoint = `${dcApiEndpoint()}/collections/${
          source.collection.id
        }`;
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
                id: `${dcUrl()}/collections/${source.collection.id}`,
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

        /** Add logo */

        /** Add provider */

        /** Add items (Canvases) from a Work's Filesets */
        source.file_sets
          .filter((fileSet) => fileSet.role === "Access")
          .forEach((fileSet, index) => {
            buildCanvasFromFileSet(fileSet, index);
          });

        source.file_sets
          .filter((fileSet) => fileSet.role === "Auxiliary")
          .forEach((fileSet, index) => {
            buildCanvasFromFileSet(fileSet, index, true);
          });
      }
    );

    const jsonManifest = builder.toPresentation3({
      id: normalizedFlatManifestObj.id,
      type: "Manifest",
    });

    /**
     * Workaround to add webVTT annotations
     * (iiif-builder package currently doesn't support it)
     */

    annotationsToTagOnAtEnd.forEach((a) => {
      const matched = jsonManifest.items.find(
        (canvas) => canvas.id === a.items[0].target
      );

      if (matched) {
        matched.annotations = [a];
      }
    });

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

module.exports = { transform };
