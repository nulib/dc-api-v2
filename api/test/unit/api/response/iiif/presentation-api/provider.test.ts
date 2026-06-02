import { describe, it, expect } from "bun:test";
import {
  provider,
  nulLogo,
} from "../../../../../../src/api/response/iiif/presentation-api/provider.ts";

describe("IIIF response presentation API provider and logo", () => {
  it("outputs a IIIF provider property", () => {
    expect(provider.id).toContain("https://www.library.northwestern.edu");
    expect(provider.type === "Agent").toBe(true);
    expect(provider.label.none[0] === "Northwestern University Libraries").toBe(
      true,
    );
    expect(provider.homepage[0].id).toContain(
      "https://dc.library.northwestern.edu",
    );
    expect(
      provider.homepage[0].label.none[0] ===
        "Northwestern University Libraries Digital Collections Homepage",
    ).toBe(true);
    expect(Array.isArray(provider.logo)).toBe(true);
    expect(provider.logo[0].id).toContain(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
    );
    expect(provider.logo[0].type === "Image").toBe(true);
    expect(provider.logo[0].format === "image/webp").toBe(true);
    expect(typeof provider.logo[0].height === "number").toBe(true);
    expect(typeof provider.logo[0].width === "number").toBe(true);
  });

  it("outputs a IIIF logo property", () => {
    expect(nulLogo.id).toContain(
      "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
    );
    expect(nulLogo.type === "Image").toBe(true);
    expect(nulLogo.format === "image/webp").toBe(true);
    expect(typeof nulLogo.height === "number").toBe(true);
    expect(typeof nulLogo.width === "number").toBe(true);
  });
});
