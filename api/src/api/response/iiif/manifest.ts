import { IIIFBuilder } from "iiif-builder";
import {
  dcApiEndpoint,
  dcUrl,
  openSearchEndpoint,
} from "../../../environment.ts";
import { transformError } from "../error.ts";
import { getWorkFileSets } from "../../opensearch.ts";
import {
  addSupplementingAnnotationToCanvas,
  addThumbnailToCanvas,
  buildAnnotationBody,
  isAltFormat,
  isAudioVideo,
  isPDF,
  buildSupplementingAnnotation as _buildSupplementingAnnotation,
} from "./presentation-api/items.ts";
import { buildPlaceholderCanvas } from "./presentation-api/placeholder-canvas.ts";
import { metadataLabelFields } from "./presentation-api/metadata.ts";
import { nulLogo, provider } from "./presentation-api/provider.ts";
import type { Paginator } from "../../pagination.ts";
import type { WorkSource, FileSetSource, NavPlace } from "./types.ts";

// deno-lint-ignore no-unused-vars
type _PaginatorUnused = Paginator;

export async function transform(
  response: { status: number; body: string },
  options: { allowPrivate?: boolean; allowUnpublished?: boolean } = {},
): Promise<Response> {
  if (response.status === 200) {
    const builder = new IIIFBuilder();
    const openSearchResponse = JSON.parse(response.body);
    const source = openSearchResponse._source as WorkSource;

    const manifestId = `${dcApiEndpoint()}/works/${source.id}?as=iiif`;

    const transcriptionMap = await fetchFileSetTranscriptions(source, options);
    const canvasAnnotations: Record<string, { id: string; type: string }> = {};

    const manifestNormalized = builder.createManifest(
      manifestId,
      (manifest) => {
        function buildCanvasFromFileSet(
          fileSet: FileSetSource,
          _index: number,
          isAuxiliary: boolean,
        ): void {
          const canvasId = fileSetCanvasId(fileSet);
          manifest.createCanvas(canvasId, (canvas) => {
            if (isAudioVideo(source.work_type))
              canvas.duration = fileSet.duration || 1;

            canvas.height = fileSet.height || 100;
            canvas.width = fileSet.width || 100;
            canvas.addLabel(fileSet.label ?? "", "none");
            addThumbnailToCanvas(canvas, fileSet);

            const annotationId = `${canvasId}/annotation/0`;
            canvas.createAnnotation(annotationId, {
              id: annotationId,
              type: "Annotation",
              motivation: "painting",
              body: buildAnnotationBody(
                fileSet,
                isAuxiliary ? "Image" : source.work_type,
              ),
            });

            if (!isAuxiliary && fileSet.webvtt) {
              addSupplementingAnnotationToCanvas(canvas, canvasId, fileSet);
            }

            const transcriptions = transcriptionMap[fileSet.id];
            if (
              source.work_type === "Image" &&
              fileSet.role === "Access" &&
              transcriptions?.length
            ) {
              canvasAnnotations[canvasId] = {
                id: `${dcApiEndpoint()}/file-sets/${
                  fileSet.id
                }/annotations?as=iiif`,
                type: "AnnotationPage",
              };
            }
          });
        }

        manifest.addLabel(source.title || "No title", "none");
        if (source.description.length > 0)
          manifest.addSummary(source.description, "none");

        metadataLabelFields(source).forEach((item) => {
          if (item.value && (item.value as unknown[]).length > 0) {
            manifest.addMetadata({ none: [item.label] }, { none: item.value });
          }
        });

        const requiredStatement = [
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

        const renderings: Record<string, unknown>[] = [];
        source.file_sets
          .filter((fs) => fs.role === "Auxiliary")
          .filter((fs) => isPDF(fs.mime_type))
          .forEach((fs) => {
            renderings.push({
              id: fs.download_url,
              type: "Text",
              label: { en: [fs.label ?? "Download PDF"] },
              format: "application/pdf",
            });
          });
        manifest.setRendering(renderings);

        if (source.rights_statement?.id)
          manifest.setRights(source.rights_statement.id);

        manifest.addThumbnail({
          id: source.thumbnail,
          type: "Image",
          width: 300,
          height: 300,
          format: "image/jpeg",
        });

        manifest.addSeeAlso({
          id: source.api_link,
          type: "Dataset",
          format: "application/json",
          label: {
            none: ["Northwestern University Libraries Digital Collections API"],
          },
        });

        manifest.setHomepage({
          id: `${dcUrl()}/items/${source.id}`,
          type: "Text",
          format: "text/html",
          label: {
            none: [
              "Homepage at Northwestern University Libraries Digital Collections",
            ],
          },
        });

        const collection = source.collection;
        if (collection?.id) {
          const collectionEndpoint = `${dcApiEndpoint()}/collections/${
            collection.id
          }`;
          manifest.setPartOf([
            {
              id: `${collectionEndpoint}?as=iiif`,
              type: "Collection",
              label: { none: [collection.title] },
              ...(collection.description && {
                summary: { none: [collection.description] },
              }),
              homepage: [
                {
                  id: `${dcUrl()}/collections/${collection.id}`,
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

        const fileSetGroups: Record<string, FileSetSource[]> = {};
        source.file_sets
          .filter((fs) => fs.role === "Access")
          .forEach((fs) => {
            const key = fs.group_with ?? fs.id;
            if (!fileSetGroups[key]) fileSetGroups[key] = [];
            fileSetGroups[key].push(fs);
          });

        Object.entries(fileSetGroups).forEach(([currentGroupKey, fileSets]) => {
          const matchingIdx = fileSets.findIndex(
            (fs) => fs.id === currentGroupKey,
          );
          if (matchingIdx > -1) {
            const [matching] = fileSets.splice(matchingIdx, 1);
            fileSets.unshift(matching);
          }
          const primaryFileSet = fileSets[0];
          const canvasId = fileSetCanvasId(primaryFileSet);

          manifest.createCanvas(canvasId, (canvas) => {
            if (isAudioVideo(source.work_type)) {
              canvas.duration = primaryFileSet.duration || 1;
            }
            canvas.height = primaryFileSet.height || 100;
            canvas.width = primaryFileSet.width || 100;
            canvas.addLabel(primaryFileSet.label ?? "", "none");
            addThumbnailToCanvas(canvas, primaryFileSet);

            const annotationId = `${canvasId}/annotation/0`;
            const choiceBody =
              fileSets.length > 1
                ? {
                    type: "Choice",
                    items: fileSets.map((fs) =>
                      buildAnnotationBody(fs, source.work_type),
                    ),
                  }
                : buildAnnotationBody(primaryFileSet, source.work_type);

            canvas.createAnnotation(annotationId, {
              id: annotationId,
              type: "Annotation",
              motivation: "painting",
              body: choiceBody,
            });

            if (primaryFileSet.webvtt) {
              addSupplementingAnnotationToCanvas(
                canvas,
                canvasId,
                primaryFileSet,
              );
            }

            const transcriptions = transcriptionMap[primaryFileSet.id];
            if (
              source.work_type === "Image" &&
              primaryFileSet.role === "Access" &&
              transcriptions?.length
            ) {
              canvasAnnotations[canvasId] = {
                id: `${dcApiEndpoint()}/file-sets/${
                  primaryFileSet.id
                }/annotations?as=iiif`,
                type: "AnnotationPage",
              };
            }
          });
        });

        source.file_sets
          .filter((fs) => fs.role === "Auxiliary")
          .filter((fs) => !isAltFormat(fs.mime_type))
          .forEach((fs, index) => buildCanvasFromFileSet(fs, index, true));

        if (source.behavior) {
          manifest.addBehavior(source.behavior.toLowerCase());
        }
      },
    );

    const jsonManifest = builder.toPresentation3({
      id: manifestNormalized.id,
      type: "Manifest",
    }) as Record<string, unknown>;

    for (
      let i = 0;
      i < (jsonManifest.items as Record<string, unknown>[]).length;
      i++
    ) {
      const canvas = (jsonManifest.items as Record<string, unknown>[])[i];

      type BodyItem = { body?: { type: string } };
      type AnnoPage = { items?: BodyItem[] };
      const annoPage = (canvas?.items as AnnoPage[] | undefined)?.[0];
      if (annoPage?.items?.[0]?.body?.type === "Image") {
        const { id, thumbnail } = canvas as {
          id: string;
          thumbnail?: Record<string, unknown>[];
        };
        if (thumbnail) {
          const placeholderFileSet = source.file_sets.find(
            (fs) =>
              fs.representative_image_url ===
              (thumbnail[0].service as Record<string, string>[])[0]["id"],
          );

          if (
            placeholderFileSet &&
            placeholderFileSet.width &&
            placeholderFileSet.height
          ) {
            (canvas as Record<string, unknown>).placeholderCanvas =
              buildPlaceholderCanvas(id, placeholderFileSet);
          }
        }
      }

      if (canvasAnnotations[(canvas as { id: string }).id]) {
        (canvas as Record<string, unknown>).annotations = [
          canvasAnnotations[(canvas as { id: string }).id],
        ];
      }
    }

    (jsonManifest as Record<string, unknown>).service = [
      {
        id: `${dcApiEndpoint()}/works/${source.id}/search?as=iiif`,
        type: "SearchService2",
      },
    ];
    (jsonManifest as Record<string, unknown>).provider = [provider];
    (jsonManifest as Record<string, unknown>).logo = [nulLogo];
    const navPlace = buildNavPlace(source);
    if (navPlace) (jsonManifest as Record<string, unknown>).navPlace = navPlace;

    return new Response(JSON.stringify(jsonManifest), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return transformError(response);
}

function fileSetCanvasId(fileSet: FileSetSource): string {
  return `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
}

async function fetchFileSetTranscriptions(
  source: WorkSource,
  options: { allowPrivate?: boolean; allowUnpublished?: boolean },
): Promise<Record<string, Record<string, unknown>[]>> {
  if (source.work_type !== "Image") return {};
  if (!openSearchEndpoint()) return {};

  const response = await getWorkFileSets(source.id, {
    allowPrivate: options.allowPrivate ?? false,
    allowUnpublished: options.allowUnpublished ?? false,
    role: "Access",
    source: ["id", "annotations"],
  });

  if (response.status !== 200) return {};

  const body = JSON.parse(response.body);
  const hits: Record<string, unknown>[] = body?.hits?.hits ?? [];

  return hits.reduce((acc: Record<string, Record<string, unknown>[]>, hit) => {
    const fileSetId = (hit._source as { id?: string })?.id;
    const annotations = (
      (hit._source as { annotations?: Record<string, unknown>[] })
        ?.annotations ?? []
    ).filter((annotation) => annotation.type === "transcription");
    if (fileSetId && annotations.length > 0) {
      acc[fileSetId] = annotations;
    }
    return acc;
  }, {});
}

function buildNavPlace(source: WorkSource): Record<string, unknown> | null {
  const navPlace = source.navPlace ?? source.nav_place;
  if (!Array.isArray(navPlace)) return null;

  const pointFeatures = navPlace
    .filter(
      (place): place is NavPlace =>
        !!place?.coordinates &&
        Array.isArray(place.coordinates) &&
        place.coordinates.length >= 2 &&
        !!place.label,
    )
    .map((place) => {
      const feature: Record<string, unknown> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: place.coordinates },
        properties: { label: { en: [place.label] } },
      };
      if (place.id) feature.id = place.id;
      if (place.summary) {
        (feature.properties as Record<string, unknown>).summary = {
          en: [place.summary],
        };
      }
      return feature;
    });

  if (!pointFeatures.length) return null;

  return { type: "FeatureCollection", features: pointFeatures };
}
