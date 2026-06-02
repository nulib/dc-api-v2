import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  openSearchEndpoint,
  prefix,
  region,
} from "../../../src/environment.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";

describe("environment", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  it("returns the index endpoint", () => {
    process.env["OPENSEARCH_ENDPOINT"] = "index.test.library.northwestern.edu";
    expect(openSearchEndpoint()).toEqual("index.test.library.northwestern.edu");
  });

  it("correctly handles an environment prefix", () => {
    process.env["ENV_PREFIX"] = "test-env";
    expect(prefix("dc-v2-work")).toEqual("test-env-dc-v2-work");
    expect(prefix("name")).toEqual("test-env-name");
  });

  it("correctly handles an empty environment prefix", () => {
    process.env["ENV_PREFIX"] = "";
    expect(prefix("name")).toEqual("name");
  });

  it("correctly handles a missing environment prefix", () => {
    delete process.env["ENV_PREFIX"];
    expect(prefix("name")).toEqual("name");
  });

  it("returns the AWS region", () => {
    process.env["AWS_REGION"] = "my-region-1";
    expect(region()).toEqual("my-region-1");
  });

  it("returns the default region", () => {
    delete process.env["AWS_REGION"];
    expect(region()).toEqual("us-east-1");
  });
});
