/**  */

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

function isAudioVideo(type) {
  return ["Audio", "Video", "Sound"].includes(type);
}

function isImage(workType) {
  return workType === "Image";
}

module.exports = {
  annotationType,
  buildAnnotationBody,
  buildAnnotationBodyId,
  buildImageResourceId,
  buildImageService,
  buildSupplementingAnnotation,
  isAudioVideo,
  isImage,
};
