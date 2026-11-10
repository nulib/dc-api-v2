import {
  AutoConfig,
  AutoModel,
  AutoTokenizer,
  env,
} from "@huggingface/transformers";

// The name Meadow records with every document vector (`embedding_model` in
// the index). Query vectors are only comparable with documents embedded by
// the same model.
export const MODEL_NAME = "embeddinggemma-2";
export const DIMENSIONS = 768;

// EmbeddingGemma is trained with task prefixes. These must match
// Meadow.Embeddings.Prompt in the Meadow repository.
export const PROMPTS = {
  query: (text) => `task: search result | query: ${text}`,
  document: (text) => `title: none | text: ${text}`,
};

const settings = () => ({
  repository:
    process.env.EMBEDDING_MODEL_REPOSITORY ||
    "onnx-community/embeddinggemma-2-ONNX",
  dtype: process.env.EMBEDDING_MODEL_DTYPE || "fp32",
  maxTokens: Number(process.env.EMBEDDING_MAX_TOKENS || 2048),
  modelPath: process.env.EMBEDDING_MODEL_PATH,
});

let loading;

// Load the text tower only. The repository also ships vision and audio
// encoders, which are never needed for search text.
async function load() {
  const { repository, dtype, modelPath } = settings();
  if (modelPath) {
    env.localModelPath = modelPath;
    env.allowRemoteModels = false;
  }

  const config = await AutoConfig.from_pretrained(repository);
  config.vision_config = config.audio_config = null;

  const [model, tokenizer] = await Promise.all([
    AutoModel.from_pretrained(repository, { config, device: "cpu", dtype }),
    AutoTokenizer.from_pretrained(repository),
  ]);
  return { model, tokenizer };
}

export function loadModel() {
  loading ||= load().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * Embed texts for the given task ("query" or "document"). Returns one
 * L2-normalized vector per text, in order.
 */
export async function embed(texts, task = "query") {
  const prompt = PROMPTS[task];
  if (!prompt) throw new RangeError(`Unknown embedding task: ${task}`);
  if (texts.length === 0) return [];

  const { model, tokenizer } = await loadModel();
  const inputs = await tokenizer(texts.map(prompt), {
    padding: true,
    truncation: true,
    max_length: settings().maxTokens,
  });
  const { sentence_embedding: output } = await model(inputs);
  return output.tolist();
}
