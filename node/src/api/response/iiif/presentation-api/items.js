/**  */

function addSupplementingAnnotationToCanvas(canvas, canvasId, fileSet) {
  canvas.createAnnotationPage(
    `${canvasId}/annotations/page/0`,
    (annotationPageBuilder) => {
      annotationPageBuilder.addLabel("Chapters", "en");
      annotationPageBuilder.createAnnotation(
        buildSupplementingAnnotation({ canvasId, fileSet })
      );
    },
    true
  );
}

function addThumbnailToCanvas(canvas, fileSet) {
  if (fileSet.representative_image_url) {
    canvas.addThumbnail({
      id: buildImageResourceId(fileSet.representative_image_url),
      type: "Image",
      width: 300,
      height: 300,
      format: "image/jpeg",
      service: buildImageService(fileSet.representative_image_url),
    });
  }
}

function annotationType(workType) {
  return workType === "Audio" ? "Sound" : workType;
}

function buildAnnotationBody(fileSet, workType) {
  const bodyType = annotationType(workType);
  const body = {
    id: buildAnnotationBodyId(fileSet, workType),
    type: bodyType,
    format: isAudioVideo(bodyType)
      ? "application/x-mpegurl"
      : fileSet.mime_type,
    height: fileSet.height || 100,
    width: fileSet.width || 100,
    label: { en: [fileSet.label || `Alternate ${workType}`] },
  };

  if (isImage(workType))
    body.service = buildImageService(fileSet.representative_image_url);
  if (isAudioVideo(workType)) body.duration = fileSet.duration;
  return body;
}

function buildAnnotationBodyId(fileSet, workType) {
  return isAudioVideo(workType)
    ? fileSet.streaming_url
    : buildImageResourceId(fileSet.representative_image_url, "600,");
}

function buildImageResourceId(uri, size = "!300,300") {
  return `${uri}/full/${size}/0/default.jpg`;
}

function buildImageService(representativeImageUrl) {
  return [
    {
      id: representativeImageUrl,
      profile: "http://iiif.io/api/image/2/level2.json",
      type: "ImageService2",
    },
  ];
}

function buildSupplementingAnnotation({ canvasId, fileSet }) {
  return {
    id: `${canvasId}/annotations/page/0/a0`,
    type: "Annotation",
    motivation: "supplementing",
    body: {
      id: fileSet?.webvtt,
      type: "Text",
      format: "text/vtt",
      language: "none",
    },
    target: canvasId,
  };
}

function isAltFormat(mimeType) {
  const acceptedTypes = [
    "application/pdf",
    "application/zip",
    "application/zip-compressed",
  ];
  return acceptedTypes.includes(mimeType);
}

function isAudioVideo(type) {
  return ["Audio", "Video", "Sound"].includes(type);
}

function isImage(workType) {
  return workType === "Image";
}

function isPDF(mimeType) {
  return mimeType === "application/pdf";
}

module.exports = {
  addSupplementingAnnotationToCanvas,
  addThumbnailToCanvas,
  annotationType,
  buildAnnotationBody,
  buildAnnotationBodyId,
  buildImageResourceId,
  buildImageService,
  buildSupplementingAnnotation,
  isAltFormat,
  isAudioVideo,
  isImage,
  isPDF,
};
