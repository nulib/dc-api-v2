import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createHandler } from "../handler.mjs";

const embed = mock(async (texts) => texts.map(() => [1, 0, 0]));
const handler = createHandler({
  embed,
  model: "embeddinggemma-2",
  dimensions: 768,
});

describe("embed handler", () => {
  beforeEach(() => embed.mockClear());

  it("embeds query text by default", async () => {
    const result = await handler({ texts: ["jazz posters"] });
    expect(result).toEqual({
      model: "embeddinggemma-2",
      dimensions: 768,
      embeddings: [[1, 0, 0]],
    });
    expect(embed).toHaveBeenCalledWith(["jazz posters"], "query");
  });

  it("passes the document task through", async () => {
    await handler({ texts: ["a", "b"], task: "document" });
    expect(embed).toHaveBeenCalledWith(["a", "b"], "document");
  });

  it.each([
    [undefined],
    [{}],
    [{ texts: [] }],
    [{ texts: "jazz" }],
    [{ texts: [42] }],
    [{ texts: ["  "] }],
    [{ texts: ["x".repeat(8193)] }],
    [{ texts: Array(17).fill("x") }],
    [{ texts: ["jazz"], task: "classification" }],
  ])("rejects invalid request %j without running the model", async (event) => {
    const result = await handler(event);
    expect(result.error).toBeString();
    expect(result.embeddings).toBeUndefined();
    expect(embed).not.toHaveBeenCalled();
  });

  it("lets model failures surface as function errors", async () => {
    embed.mockImplementationOnce(async () => {
      throw new Error("session failed");
    });
    expect(handler({ texts: ["jazz"] })).rejects.toThrow("session failed");
  });
});
