const { prefix } = require("../../aws/environment");

const mapTargets = {
  works: "dc-v2-work",
  "file-sets": "dc-v2-file-set",
  collections: "dc-v2-collection",
};

function validModels(models) {
  return models.every(isAllowed);
}

function isAllowed(model) {
  return mapTargets.hasOwnProperty(model);
}

function modelsToTargets(models) {
  return String(models.map((model) => prefix(mapTargets[model])));
}

module.exports = { modelsToTargets, validModels };
