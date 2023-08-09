const chai = require("chai");
const expect = chai.expect;

describe("package.json", () => {
  const rootPackage = requireSource("../package.json");
  const srcPackage = requireSource("./package.json");

  it("root package has no external runtime dependencies", () => {
    expect(Object.keys(rootPackage.dependencies)).to.eql(["dc-api"]);
  });

  it("root and src packages are the same version", () => {
    expect(rootPackage.version).to.eq(srcPackage.version);
  });
});
