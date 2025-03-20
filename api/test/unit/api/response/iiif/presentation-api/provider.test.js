"use strict";

const chai = require("chai");
const expect = chai.expect;

const { provider, nulLogo } = requireSource(
  "api/response/iiif/presentation-api/provider"
);

describe("IIIF response presentation API provider and logo", () => {
  it("outputs a IIIF provider property", async () => {
    expect(provider.id).to.contain("https://www.library.northwestern.edu");
    expect(provider.type).to.eq("Agent");
    expect(provider.label.none[0]).to.eq("Northwestern University Libraries");
    expect(provider.homepage[0].id).to.contain(
      "https://dc.library.northwestern.edu"
    );
    expect(provider.homepage[0].label.none[0]).to.eq(
      "Northwestern University Libraries Digital Collections Homepage"
    );
    expect(provider.logo).to.be.an("array");
    expect(provider.logo[0].id).to.contain(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp"
    );
    expect(provider.logo[0].type).to.eq("Image");
    expect(provider.logo[0].format).to.eq("image/webp");
    expect(provider.logo[0].height).to.be.a("number");
    expect(provider.logo[0].width).to.be.a("number");
  });

  it("outputs a IIIF logo property", async () => {
    expect(nulLogo.id).to.contain(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp"
    );
    expect(nulLogo.type).to.eq("Image");
    expect(nulLogo.format).to.eq("image/webp");
    expect(nulLogo.height).to.be.a("number");
    expect(nulLogo.width).to.be.a("number");
  });
});
