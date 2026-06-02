import { describe, it, afterEach, beforeEach, expect } from "bun:test";
import * as models from "../../../../src/api/request/models.ts";
import { setupEnv, teardownEnv } from "../../../test-helpers/index.ts";

describe("models", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  it("knows valid models", () => {
    expect(
      models.validModels(["collections", "file-sets", "works"], "opensearch"),
    ).toEqual(true);
  });

  it("detects invalid models", () => {
    expect(models.validModels(["works", "foo"], "opensearch")).toEqual(false);
  });

  it("maps models to targets", () => {
    let result = models.modelsToTargets(["collections", "file-sets", "works"]);
    expect(result).toEqual("dc-v2-collection,dc-v2-file-set,dc-v2-work");

    process.env["ENV_PREFIX"] = "pre";
    result = models.modelsToTargets(["collections", "file-sets", "works"]);
    expect(result).toEqual(
      "pre-dc-v2-collection,pre-dc-v2-file-set,pre-dc-v2-work",
    );
  });
});
