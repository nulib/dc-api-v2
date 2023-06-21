const { prefix } = require("../../environment");

const mapTargets = {
  works: "dc-v2-work",
  "file-sets": "dc-v2-file-set",
  collections: "dc-v2-collection",
};

function extractRequestedModels(requestedModels) {
  return requestedModels == null ? ["works"] : requestedModels.split(",");
}

function validModels(models, format) {
  if (format === "iiif") {
    return models.length == 1 && models.every((model) => model === "works");
  }
  return models.every(isAllowed);
}

function isAllowed(model) {
  return Object.prototype.hasOwnProperty.call(mapTargets, model);
}

function modelsToTargets(models) {
  return String(models.map((model) => prefix(mapTargets[model])));
}

module.exports = { extractRequestedModels, modelsToTargets, validModels };
