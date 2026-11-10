import { DIMENSIONS, MODEL_NAME, embed, loadModel } from "./embedder.mjs";
import { createHandler } from "./handler.mjs";

// Start loading during init so the first invocation does not pay for it
// inside its own timeout. A failure here is retried by the next invocation.
loadModel().catch(() => {});

export const handler = createHandler({
  embed,
  model: MODEL_NAME,
  dimensions: DIMENSIONS,
});
