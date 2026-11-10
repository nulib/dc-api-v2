const MAX_TEXTS = 16;
const MAX_TEXT_LENGTH = 8192;

class RequestError extends Error {}

function validate(event) {
  const texts = event?.texts;
  const task = event?.task ?? "query";

  if (!Array.isArray(texts) || texts.length === 0)
    throw new RequestError("`texts` must be a non-empty array of strings");
  if (texts.length > MAX_TEXTS)
    throw new RequestError(`\`texts\` may contain at most ${MAX_TEXTS} items`);
  if (
    texts.some(
      (text) =>
        typeof text !== "string" ||
        text.trim() === "" ||
        text.length > MAX_TEXT_LENGTH,
    )
  )
    throw new RequestError(
      `each text must be a non-empty string of at most ${MAX_TEXT_LENGTH} characters`,
    );
  if (!["query", "document"].includes(task))
    throw new RequestError('`task` must be "query" or "document"');

  return { texts, task };
}

/**
 * Build the Lambda handler around an embedder (see embedder.mjs).
 *
 * The function is invoked directly (not through API Gateway) with
 *   { "texts": ["..."], "task": "query" | "document" }
 * and returns
 *   { "model": "embeddinggemma-2", "dimensions": 768, "embeddings": [[...]] }
 * Invalid requests return { "error": "..." } rather than throwing, so
 * callers can tell them apart from function failures.
 */
export const createHandler =
  ({ embed, model, dimensions }) =>
  async (event) => {
    try {
      const { texts, task } = validate(event);
      return { model, dimensions, embeddings: await embed(texts, task) };
    } catch (error) {
      if (error instanceof RequestError) return { error: error.message };
      throw error;
    }
  };
