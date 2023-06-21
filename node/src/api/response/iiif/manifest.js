const { IIIFBuilder } = require("iiif-builder");
const { dcApiEndpoint, dcUrl } = require("../../../environment");
const { transformError } = require("../error");
const {
  buildAnnotationBody,
  buildImageResourceId,
  buildImageService,
  isAudioVideo,
  buildSupplementingAnnotation,
} = require("./presentation-api/items");
const { metadataLabelFields } = require("./presentation-api/metadata");
const {
  buildPlaceholderCanvas,
} = require("./presentation-api/placeholder-canvas");

function transform(response) {
  if (response.statusCode === 200) {
    const builder = new IIIFBuilder();

    const openSearchResponse = JSON.parse(response.body);
    const source = openSearchResponse._source;

    const manifestId = `${dcApiEndpoint()}/works/${source.id}?as=iiif`;

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
              canvas.createAnnotationPage(
                `${canvasId}/annotations/page/0`,
                (annotationPageBuilder) => {
                  annotationPageBuilder.createAnnotation(
                    buildSupplementingAnnotation({ canvasId, fileSet })
                  );
                },
                true
              );
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
     * Add a placeholderCanvas property to a Canvas if the annotation body is of type "Image"
     * (iiif-builder package currently doesn't support adding this property)
     */
    for (let i = 0; i < jsonManifest.items.length; i++) {
      if (jsonManifest.items[i]?.items[0]?.items[0]?.body.type === "Image") {
        const { id, thumbnail } = jsonManifest.items[i];
        const placeholderFileSet = source.file_sets.find(
          (fileSet) =>
            fileSet.representative_image_url === thumbnail[0].service[0]["@id"]
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

    /** Add logo manually (w/o IIIF Builder) */
    const nulLogo = {
      id: "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
      type: "Image",
      format: "image/webp",
      height: 139,
      width: 1190,
    };
    jsonManifest.logo = [nulLogo];

    /** Add provider manually (w/o IIIF Builder) */
    const provider = {
      id: "https://www.library.northwestern.edu/",
      type: "Agent",
      label: { none: ["Northwestern University Libraries"] },
      homepage: [
        {
          id: "https://dc.library.northwestern.edu/",
          type: "Text",
          label: {
            none: [
              "Northwestern University Libraries Digital Collections Homepage",
            ],
          },
          format: "text/html",
          language: ["en"],
        },
      ],
      logo: [nulLogo],
    };
    jsonManifest.provider = [provider];

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
