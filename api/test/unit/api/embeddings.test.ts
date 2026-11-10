import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { InvokeCommand } from "@aws-sdk/client-lambda";
import {
  clearEmbeddingCache,
  embedQuery,
  EmbeddingError,
  setEmbeddingClient,
} from "../../../src/api/embeddings.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";

type Reply = Record<string, unknown> | Error;

describe("embedQuery", () => {
  let calls: InvokeCommand["input"][];
  let replies: Reply[];

  // Each invocation consumes the next reply; the last one repeats
  const respondWith = (...queued: Reply[]) => (replies = queued);
  const payload = (body: unknown) => ({
    Payload: Buffer.from(JSON.stringify(body)),
  });

  beforeEach(() => {
    setupEnv({ EMBEDDING_FUNCTION: "arn:aws:lambda:test:embed:live" });
    clearEmbeddingCache();
    calls = [];
    replies = [];
    setEmbeddingClient({
      send: async (command: InvokeCommand) => {
        calls.push(command.input);
        const reply = replies.length > 1 ? replies.shift()! : replies[0];
        if (reply instanceof Error) throw reply;
        return reply;
      },
    } as never);
  });

  afterEach(() => {
    setEmbeddingClient(undefined);
    teardownEnv();
  });

  it("invokes the embed function with the query text", async () => {
    respondWith(
      payload({ model: "embeddinggemma-2", embeddings: [[0.1, 0.2]] }),
    );

    expect(await embedQuery("jazz posters")).toEqual([0.1, 0.2]);

    expect(calls).toHaveLength(1);
    expect(calls[0].FunctionName).toBe("arn:aws:lambda:test:embed:live");
    expect(
      JSON.parse(Buffer.from(calls[0].Payload as Uint8Array).toString()),
    ).toEqual({ texts: ["jazz posters"], task: "query" });
  });

  it("caches embeddings by query text", async () => {
    respondWith(payload({ embeddings: [[1, 0]] }));

    await embedQuery("jazz posters");
    await embedQuery("jazz posters");
    await embedQuery("blues posters");

    expect(calls).toHaveLength(2);
  });

  it("does not cache failures", async () => {
    respondWith(new Error("throttled"), payload({ embeddings: [[1, 0]] }));

    expect(embedQuery("jazz")).rejects.toThrow(EmbeddingError);
    expect(await embedQuery("jazz")).toEqual([1, 0]);
  });

  it("raises an EmbeddingError when the function fails", async () => {
    respondWith({
      FunctionError: "Unhandled",
      ...payload({ errorMessage: "session failed" }),
    });
    expect(embedQuery("jazz")).rejects.toThrow("Embedding function failed");
  });

  it("raises an EmbeddingError when the request is rejected", async () => {
    respondWith(payload({ error: "`texts` must be a non-empty array" }));
    expect(embedQuery("jazz")).rejects.toThrow("`texts` must be a non-empty");
  });

  it("raises an EmbeddingError when no embedding comes back", async () => {
    respondWith(payload({ embeddings: [] }));
    expect(embedQuery("jazz")).rejects.toThrow(EmbeddingError);
  });

  it("raises an EmbeddingError when the function is not configured", async () => {
    delete process.env.EMBEDDING_FUNCTION;
    expect(embedQuery("jazz")).rejects.toThrow(
      "EMBEDDING_FUNCTION is not configured",
    );
    expect(calls).toHaveLength(0);
  });
});
