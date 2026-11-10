/**
 * Runs the embed function's handler in-process for local development, in
 * place of invoking the deployed Lambda. See ../embed.
 */
import type { InvokeCommand } from "@aws-sdk/client-lambda";
import { setEmbeddingClient } from "./src/api/embeddings.ts";

type Handler = (event: unknown) => Promise<unknown>;

let handler: Handler | undefined;

// Imported lazily so the server starts without loading the model runtime
async function loadHandler(): Promise<Handler> {
  if (!handler) {
    const embedder = "../embed/embedder.mjs";
    const handlerModule = "../embed/handler.mjs";
    const { DIMENSIONS, MODEL_NAME, embed } = await import(embedder);
    const { createHandler } = await import(handlerModule);
    handler = createHandler({
      embed,
      model: MODEL_NAME,
      dimensions: DIMENSIONS,
    }) as Handler;
  }
  return handler;
}

export function useLocalEmbedder(): void {
  setEmbeddingClient({
    send: async (command: InvokeCommand) => {
      const event = JSON.parse(
        Buffer.from(command.input.Payload as Uint8Array).toString("utf-8"),
      );
      const result = await (await loadHandler())(event);
      return { Payload: Buffer.from(JSON.stringify(result)) };
    },
  } as never);
}
