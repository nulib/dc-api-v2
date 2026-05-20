import { describe, it, expect } from "bun:test";
import pkg from "../../package.json" with { type: "json" };

describe("package versions", () => {
  it("package has a version", () => {
    expect(typeof pkg.version).toEqual("string");
  });
});
