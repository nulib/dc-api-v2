"use strict";

const {
  formatSingleValuedField,
  metadataLabelFields,
} = require("../../../../../../src/api/response/iiif/presentation-api/metadata");
const chai = require("chai");
const expect = chai.expect;

describe("IIIF response presentation API metadata helpers", () => {
  const response = {
    statusCode: 200,
    body: helpers.testFixture("mocks/work-1234.json"),
  };
  const source = JSON.parse(response.body)._source;

  it("formatSingleValuedField(value)", () => {
    expect(formatSingleValuedField("This value."))
      .to.be.an("array")
      .that.does.include("This value.");
    expect(formatSingleValuedField(null)).to.be.an("array").that.is.empty;
  });

  it("metadataLabelFields(source)", () => {
    const metadata = metadataLabelFields(source);
    expect(Array.isArray(metadata)).to.be;
    expect(metadata.length).to.eq(29);
    metadata.forEach((item) => {
      expect(item.label).to.be.a("string");
      expect(item.value).to.be.an("array");
    });
  });
});
