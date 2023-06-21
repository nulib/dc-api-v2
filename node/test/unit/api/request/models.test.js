"use strict";

const chai = require("chai");
const expect = chai.expect;

const models = requireSource("api/request/models");

describe("models", () => {
  helpers.saveEnvironment();

  it("knows valid models", () => {
    expect(models.validModels(["collections", "file-sets", "works"])).to.be
      .true;
  });

  it("detects invalid models", () => {
    expect(models.validModels(["works", "foo"])).to.be.false;
  });

  it("maps models to targets", () => {
    let result = models.modelsToTargets(["collections", "file-sets", "works"]);
    expect(result).to.eq("dc-v2-collection,dc-v2-file-set,dc-v2-work");

    process.env.ENV_PREFIX = "pre";
    result = models.modelsToTargets(["collections", "file-sets", "works"]);
    expect(result).to.eq(
      "pre-dc-v2-collection,pre-dc-v2-file-set,pre-dc-v2-work"
    );
  });
});
