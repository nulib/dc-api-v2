"use strict";

const environment = require("../../../src/aws/environment");

const chai = require("chai");
const expect = chai.expect;

describe("environment", function () {
  helpers.saveEnvironment();

  it("returns the index endpoint", function () {
    process.env.ELASTICSEARCH_ENDPOINT = "index.test.library.northwestern.edu";
    expect(environment.elasticsearchEndpoint()).to.eq(
      "index.test.library.northwestern.edu"
    );
  });

  it("correctly handles an environment prefix", function () {
    process.env.ENV_PREFIX = "test-env";
    expect(environment.prefix()).to.eq("test-env");
    expect(environment.prefix("name")).to.eq("test-env-name");
  });

  it("correctly handles an empty environment prefix", function () {
    process.env.ENV_PREFIX = "";
    expect(environment.prefix()).to.eq("");
    expect(environment.prefix("name")).to.eq("name");
  });

  it("correctly handles a missing environment prefix", function () {
    delete process.env.ENV_PREFIX;
    expect(environment.prefix()).to.eq("");
    expect(environment.prefix("name")).to.eq("name");
  });

  it("returns the AWS region", function () {
    process.env.AWS_REGION = "my-region-1";
    expect(environment.region()).to.eq("my-region-1");
  });

  it("returns the default region", function () {
    delete process.env.AWS_REGION;
    expect(environment.region()).to.eq("us-east-1");
  });
});
