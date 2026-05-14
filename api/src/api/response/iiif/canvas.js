const { dcApiEndpoint } = require("../../../environment");
const { getWork } = require("../../opensearch");
const { transformError } = require("../error");
const {
  addThumbnailToCanvas,
  buildImageResourceId,
  buildImageService,
} = require("./presentation-api/items");
const {
  buildPlaceholderCanvas,
} = require("./presentation-api/placeholder-canvas");

async function transform(response, options = {}) {
  if (response.statusCode !== 200) return transformError(response);

  const openSearchResponse = JSON.parse(response.body);
  const fileSet = openSearchResponse._source;
  const canvasId = `${dcApiEndpoint()}/file-sets/${fileSet.id}?as=iiif`;
  const { width, height } = dimensions(fileSet);

  const canvas = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: canvasId,
    type: "Canvas",
    width,
    height,
    label: { none: [label(fileSet)] },
    items: [annotationPage(canvasId, fileSet, { width, height })],
    service: [
      {
        id: `${dcApiEndpoint()}/file-sets/${fileSet.id}/search?as=iiif`,
        type: "SearchService2",
      },
    ],
  };

  if (fileSet.description) {
    canvas.summary = { none: [fileSet.description] };
  }

  if (fileSet.representative_image_url) {
    const thumbnailBuilder = {
      thumbnails: [],
      addThumbnail(thumbnail) {
        this.thumbnails.push(thumbnail);
      },
    };
    addThumbnailToCanvas(thumbnailBuilder, fileSet);
    canvas.thumbnail = thumbnailBuilder.thumbnails;
  }

  if (
    isImage(fileSet) &&
    fileSet.representative_image_url &&
    fileSetWidth(fileSet) &&
    fileSetHeight(fileSet)
  ) {
    canvas.placeholderCanvas = buildPlaceholderCanvas(canvasId, {
      ...fileSet,
      width,
      height,
    });
  }

  const partOf = await parentManifest(fileSet, options);
  if (partOf) {
    canvas.partOf = [partOf];
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(canvas),
  };
}

function annotationPage(canvasId, fileSet, dimensions) {
  const pageId = `${canvasId}/annotation-page`;
  return {
    id: pageId,
    type: "AnnotationPage",
    items: [
      {
        id: `${canvasId}/annotation/0`,
        type: "Annotation",
        motivation: "painting",
        target: canvasId,
        body: annotationBody(fileSet, dimensions),
      },
    ],
  };
}

function annotationBody(fileSet, { width, height }) {
  const body = {
    id: bodyId(fileSet),
    type: bodyType(fileSet),
    format: fileSet.mime_type,
    label: { en: [label(fileSet)] },
  };

  if (["Image", "Video"].includes(body.type)) {
    body.width = width;
    body.height = height;
  }

  if (body.type === "Image" && fileSet.representative_image_url) {
    body.service = buildImageService(fileSet.representative_image_url);
  }

  if (["Sound", "Video"].includes(body.type) && fileSet.duration) {
    body.duration = fileSet.duration;
  }

  return body;
}

function bodyId(fileSet) {
  if (isImage(fileSet) && fileSet.representative_image_url) {
    return buildImageResourceId(fileSet.representative_image_url, "600,");
  }
  return (
    fileSet.streaming_url ||
    fileSet.download_url ||
    fileSet.api_link ||
    `${dcApiEndpoint()}/file-sets/${fileSet.id}`
  );
}

function bodyType(fileSet) {
  const mimeType = fileSet.mime_type || "";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("audio/")) return "Sound";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType === "application/pdf") return "Text";
  return "Dataset";
}

function dimensions(fileSet) {
  return {
    width: fileSetWidth(fileSet) || 100,
    height: fileSetHeight(fileSet) || 100,
  };
}

function fileSetWidth(fileSet) {
  return fileSet.width || fileSet.extracted_metadata?.exif?.value?.imageWidth;
}

function fileSetHeight(fileSet) {
  return fileSet.height || fileSet.extracted_metadata?.exif?.value?.imageHeight;
}

function isImage(fileSet) {
  return fileSet.mime_type?.startsWith("image/");
}

function label(fileSet) {
  return fileSet.label || fileSet.original_filename || fileSet.id;
}

async function parentManifest(fileSet, options) {
  if (!fileSet.work_id) return null;

  return {
    id: `${dcApiEndpoint()}/works/${fileSet.work_id}?as=iiif`,
    type: "Manifest",
    label: { en: [await workTitle(fileSet, options)] },
  };
}

async function workTitle(fileSet, options) {
  if (fileSet.work_title) return fileSet.work_title;

  let response;
  try {
    response = await getWork(fileSet.work_id, {
      allowPrivate: options.allowPrivate,
      allowUnpublished: options.allowUnpublished,
    });
  } catch (_error) {
    return fileSet.work_id;
  }
  if (response.statusCode !== 200) return fileSet.work_id;

  return JSON.parse(response.body)?._source?.title || fileSet.work_id;
}

module.exports = {
  annotationBody,
  bodyType,
  dimensions,
  transform,
};
