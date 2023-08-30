const { ChatOpenAI } = require("langchain/chat_models/openai");
const { default: Weaviate } = require("weaviate-ts-client");
const { EmbeddedWeaviateStore } = require("../chat/embedded-weaviate-store");
const { BaseTracer } = require("langchain/callbacks");

class StreamingMultipartCallbackHandler extends BaseTracer {
  name = "streaming_stdout_callback_handler";

  persistRun(_) {
    return Promise.resolve();
  }

  constructor({ multipart, ...args }) {
    super(args);
    this.multipart = multipart;
  }

  onLLMNewToken(run) {
    const { token } = run.events[run.events.length - 1].kwargs;
    this.multipart.write(token);
  }

  onLLMEnd(_run) {
    this.multipart.end();
  }
}

function openAIClient(deployment, { stream }) {
  const callbacks = stream
    ? [new StreamingMultipartCallbackHandler({ stream })]
    : [];

  return new ChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
    azureOpenAIApiDeploymentName: deployment,
    azureOpenAIApiVersion: "2023-07-01-preview",
    maxTokens: -1,
    modelName: "gpt-4",
    streaming: true,
    callbacks,
  });
}

function weaviateVectorStore({ indexName, textKey, attributes }) {
  const url = new URL(process.env.WEAVIATE_URL);
  const client = new Weaviate.client({
    scheme: url.protocol.slice(0, -1),
    host: url.hostname,
    apiKey: new Weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
  });

  return EmbeddedWeaviateStore.fromExistingIndex(null, {
    client,
    indexName,
    textKey,
    metadataKeys: attributes,
  });
}

module.exports = { openAIClient, weaviateVectorStore };
