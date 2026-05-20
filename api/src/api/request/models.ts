import { prefix } from "../../environment.ts";

const mapTargets: Record<string, string> = {
  works: "dc-v2-work",
  "file-sets": "dc-v2-file-set",
  collections: "dc-v2-collection",
};

export function extractRequestedModels(
  requestedModels: string | null | undefined,
): string[] {
  return requestedModels == null ? ["works"] : requestedModels.split(",");
}

export function validModels(models: string[], format: string): boolean {
  if (format === "iiif") {
    return (
      models.length == 1 &&
      models.every((model) => model === "works" || model === "collections")
    );
  }
  return models.every(isAllowed);
}

function isAllowed(model: string): boolean {
  return Object.prototype.hasOwnProperty.call(mapTargets, model);
}

export function modelsToTargets(models: string[]): string {
  return String(models.map((model) => prefix(mapTargets[model])));
}
