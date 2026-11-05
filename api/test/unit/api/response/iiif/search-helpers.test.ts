import { describe, expect, it } from "bun:test";
import {
  buildSearchContext,
  CONTEXT_PREFIX_LENGTH,
  CONTEXT_SUFFIX_LENGTH,
  MAX_CONTEXT_MATCHES,
} from "../../../../../src/api/response/iiif/search-helpers.ts";

const source = "https://example.org/annotation/1";
const searchId = "https://example.org/search?q=fireworks";
const items = (value: string) => [{ id: source, body: { value } }];

describe("IIIF search match context", () => {
  it("bounds context around the match while preserving the original body", () => {
    const text = "Before ".repeat(40) + "Fireworks" + " after".repeat(40);
    const annotations = items(text);
    const [page] = buildSearchContext(annotations, "fireworks", searchId);
    const [hit] = page.items;
    expect(hit.target.source).toBe(source);
    expect(hit.target.selector[0]).toEqual({
      type: "TextQuoteSelector",
      prefix: text.slice(220, 280),
      exact: "Fireworks",
      suffix: text.slice(289, 389),
    });
    expect(annotations[0].body.value).toBe(text);
  });

  it("emits distinct stable IDs for repeated matches, including text boundaries", () => {
    const input = items("fireworks and FIREWORKS");
    const [page] = buildSearchContext(input, "fireworks", searchId);
    expect(page.items).toHaveLength(2);
    expect(page.items[0].id).not.toBe(page.items[1].id);
    expect(page.items[0].target.selector[0].prefix).toBe("");
    expect(page.items[1].target.selector[0].suffix).toBe("");
    expect(page.items[1].target.selector[0].exact).toBe("FIREWORKS");
    expect(buildSearchContext(input, "fireworks", searchId)).toEqual([page]);
  });

  it("treats punctuation literally and preserves phrases and newlines", () => {
    const [page] = buildSearchContext(
      items("Intro\nA+B (test)\nend"),
      "a+b (test)",
      searchId,
    );
    expect(page.items[0].target.selector[0]).toEqual({
      type: "TextQuoteSelector",
      prefix: "Intro\n",
      exact: "A+B (test)",
      suffix: "\nend",
    });
  });

  it("keeps offsets correct after Unicode text", () => {
    const [page] = buildSearchContext(
      items("İ 🎆 fireworks"),
      "fireworks",
      searchId,
    );
    expect(page.items[0].target.selector[0].prefix).toBe("İ 🎆 ");
    expect(page.items[0].target.selector[0].exact).toBe("fireworks");
  });

  it("does not split surrogate pairs at the prefix or suffix boundary", () => {
    // "a" shifts the match to an odd code-unit offset, so the 60/100 cuts
    // would otherwise land inside an emoji.
    const text = "🎆".repeat(40) + "ax" + "b" + "🎆".repeat(60);
    const [page] = buildSearchContext(items(text), "x", searchId);
    const { prefix, suffix } = page.items[0].target.selector[0];
    expect(prefix).toBe("🎆".repeat(29) + "a");
    expect(suffix).toBe("b" + "🎆".repeat(49));
    expect(prefix.length).toBeLessThanOrEqual(CONTEXT_PREFIX_LENGTH);
    expect(suffix.length).toBeLessThanOrEqual(CONTEXT_SUFFIX_LENGTH);
    expect(prefix).not.toMatch(/^[\udc00-\udfff]/);
    expect(suffix).not.toMatch(/[\ud800-\udbff]$/);
  });

  it("caps context annotations across all items", () => {
    const many = [
      {
        id: "https://example.org/annotation/1",
        body: { value: "e".repeat(80) },
      },
      {
        id: "https://example.org/annotation/2",
        body: { value: "e".repeat(80) },
      },
    ];
    const [page] = buildSearchContext(many, "e", searchId);
    expect(page.items).toHaveLength(MAX_CONTEXT_MATCHES);
    const sources = page.items.map((hit) => hit.target.source);
    expect(sources.filter((s) => s === many[0].id)).toHaveLength(80);
    expect(sources.filter((s) => s === many[1].id)).toHaveLength(
      MAX_CONTEXT_MATCHES - 80,
    );
  });

  it("returns no context for empty queries, missing text, or no matches", () => {
    for (const query of ["", " ", "absent"]) {
      expect(buildSearchContext(items("fireworks"), query, searchId)).toEqual(
        [],
      );
    }
    expect(buildSearchContext([], "fireworks", searchId)).toEqual([]);
  });
});
