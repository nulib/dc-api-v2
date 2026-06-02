import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { metadataLabelFields } from "../../../../../../src/api/response/iiif/presentation-api/metadata.ts";
import {
  setupEnv,
  teardownEnv,
  testFixture,
} from "../../../../../test-helpers/index.ts";

describe("IIIF response presentation API metadata helpers", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  const response = {
    status: 200,
    body: testFixture("mocks/work-1234.json"),
  };
  const source = JSON.parse(response.body)._source;

  it("metadataLabelFields(source)", () => {
    const metadata = metadataLabelFields(source);
    expect(Array.isArray(metadata)).toBe(true);
    expect(metadata.length).toEqual(30);
    for (const item of metadata) {
      expect(typeof item.label === "string").toBe(true);
      expect(!item.label.includes("Keyword")).toBe(true);
    }
  });
});
