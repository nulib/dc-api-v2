import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

/**
 * Query embeddings for semantic search.
 *
 * Meadow stores an EmbeddingGemma 2 vector with every work document, so the
 * search index has no model of its own. Search text is embedded by the embed
 * function (see ../../../embed), which runs the same model.
 */

export type Embedder = (text: string) => Promise<number[]>;

export class EmbeddingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}

const CACHE_SIZE = 500;
const cache = new Map<string, number[]>();
type InvokeClient = Pick<LambdaClient, "send">;
let client: InvokeClient | undefined;

/** Replace the Lambda client (for tests). Pass `undefined` to restore the default. */
export function setEmbeddingClient(replacement?: InvokeClient): void {
  client = replacement;
}

function remember(text: string, vector: number[]): void {
  cache.delete(text);
  cache.set(text, vector);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

export function clearEmbeddingCache(): void {
  cache.clear();
}

interface EmbedResponse {
  embeddings?: number[][];
  error?: string;
}

async function invoke(text: string): Promise<number[]> {
  const functionName = process.env.EMBEDDING_FUNCTION;
  if (!functionName)
    throw new EmbeddingError("EMBEDDING_FUNCTION is not configured");

  client ||= new LambdaClient({});
  let result;
  try {
    result = await client.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify({ texts: [text], task: "query" })),
      }),
    );
  } catch (cause) {
    throw new EmbeddingError("Embedding function could not be invoked", {
      cause,
    });
  }

  if (result.FunctionError)
    throw new EmbeddingError(
      `Embedding function failed: ${result.FunctionError}`,
    );

  const body = JSON.parse(
    Buffer.from(result.Payload ?? []).toString("utf-8") || "{}",
  ) as EmbedResponse;
  const vector = body.embeddings?.[0];
  if (body.error || !Array.isArray(vector))
    throw new EmbeddingError(
      body.error ?? "Embedding function returned no embedding",
    );

  return vector;
}

/** Embed search text. Results are cached for the life of the function instance. */
export const embedQuery: Embedder = async (text) => {
  const cached = cache.get(text);
  if (cached) {
    remember(text, cached);
    return cached;
  }

  const vector = await invoke(text);
  remember(text, vector);
  return vector;
};
