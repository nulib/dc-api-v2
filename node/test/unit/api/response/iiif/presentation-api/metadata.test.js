"use strict";

const chai = require("chai");
const expect = chai.expect;

const { formatSingleValuedField, metadataLabelFields } = requireSource(
  "api/response/iiif/presentation-api/metadata"
);

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
    expect(metadata.length).to.eq(28);
    metadata.forEach((item) => {
      expect(item.label).to.be.a("string");
      expect(item.value).to.be.an("array");
      expect(item.label).to.not.contain("Keyword");
    });
  });
});
