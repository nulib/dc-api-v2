import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DIMENSIONS, PROMPTS, embed } from "../embedder.mjs";

describe("prompts", () => {
  it("match Meadow's document and query prompts", () => {
    expect(PROMPTS.query("jazz")).toBe("task: search result | query: jazz");
    expect(PROMPTS.document("jazz")).toBe("title: none | text: jazz");
  });

  it("rejects an unknown task", () => {
    expect(embed(["jazz"], "nope")).rejects.toThrow(RangeError);
  });

  it("returns nothing for no texts without loading the model", async () => {
    expect(await embed([])).toEqual([]);
  });
});

// Runs the real model when it is available locally:
//   EMBEDDING_MODEL_PATH=/path/to/models bun test
const modelPath = process.env.EMBEDDING_MODEL_PATH;
const available =
  modelPath &&
  existsSync(
    join(modelPath, "onnx-community/embeddinggemma-2-ONNX/tokenizer.json"),
  );

describe.skipIf(!available)("embed (real model)", () => {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

  it("returns normalized vectors that rank the relevant document first", async () => {
    const [query] = await embed(["Which planet is known as the Red Planet?"]);
    const documents = await embed(
      [
        "Venus is often called Earth's twin because of its similar size.",
        "Mars, known for its reddish appearance, is the Red Planet.",
        "Jupiter, the largest planet, has a prominent red spot.",
      ],
      "document",
    );

    expect(query).toHaveLength(DIMENSIONS);
    expect(dot(query, query)).toBeCloseTo(1, 3);
    const scores = documents.map((document) => dot(query, document));
    expect(scores.indexOf(Math.max(...scores))).toBe(1);
  }, 120_000);
});
