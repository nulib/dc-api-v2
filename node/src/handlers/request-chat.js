const { __processRequest } = require("./middleware");
const { addCorsHeaders, encodeToken } = require("../helpers");
const { loadQAStuffChain } = require("langchain/chains");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { PromptTemplate } = require("langchain/prompts");
const { default: Weaviate } = require("weaviate-ts-client");
const { EmbeddedWeaviateStore } = require("../embedded-weaviate-store");
const { BaseTracer } = require("langchain/callbacks");
const debug = require("debug")("api.request-chat");
const { documentTemplate, promptTemplate } = require("./chat-prompts");
const { streamifyResponse, HttpResponseStream } = global.awslambda;

const DefaultIndex = "Work";
const DefaultKey = "title";
const DefaultAttributes = [
  "title",
  "accession_number",
  "alternate_title",
  "api_model",
  "catalog_key",
  "collection",
  "contributor",
  "create_date",
  "creator",
  "date_created",
  "description",
  "genre",
  "identifier_descriptive",
  "keywords",
  "language",
  "library_unit",
  "location",
  "physical_description_material",
  "physical_description_size",
  "preservation_level",
  "published",
  "related_material",
  "related_url",
  "rights_holder",
  "rights_statement",
  "scope_and_contents",
  "series",
  "source",
  "status",
  "style_period",
  "subject",
  "table_of_contents",
  "technique",
  "visibility",
  "work_type",
];

class MultiPartStream {
  constructor(stream, initialResponse) {
    debug("Creating MultipartStream", initialResponse);
    this.boundary = `--stream-boundary-${Number(new Date())}`;
    this.stream = HttpResponseStream.from(stream, {
      ...initialResponse,
      "Content-Type": `multipart/mixed; boundary='${this.boundary}'`,
    });
  }

  newPart(headers) {
    debug("New part", headers);
    const head = [this.boundary];
    for (const header in headers) {
      head.push(`${header}: ${headers[header]}`);
    }
    head.push("");
    this.write(head.join("\n"));
  }

  write(content) {
    this.stream.write(`${content.length.toString(16)}\r\n${content}\r\n`);
  }

  end() {
    this.stream.end();
  }
}

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

const handler = async (event, stream) => {
  event = __processRequest(event);
  debug(event);
  let response;

  if (!event.userToken?.isLoggedIn()) {
    debug("Unauthorized");
    response = {
      statusCode: 401,
      headers: {
        "Content-Type": "text/plain",
      },
      body: "Unauthorized",
    };
    response = addCorsHeaders(event, response);
    response = encodeToken(event, response);
    stream = HttpResponseStream.from(stream, response);
    stream.write("Unauthorized");
    stream.end();
    return;
  }

  try {
    let question, docs;
    response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "3600",
      },
    };
    response = addCorsHeaders(event, response);
    response = encodeToken(event, response);
    const multipart = new MultiPartStream(stream, response);

    question =
      event?.requestContext?.http?.method == "POST"
        ? event.body
        : event.queryStringParameters?.q;
    const indexName = event.queryStringParameters?.index || DefaultIndex;
    const textKey = event.queryStringParameters?.text_key || DefaultKey;
    const attributes = extractAttributes(event, [textKey]);

    const callbacks = [new StreamingMultipartCallbackHandler({ multipart })];
    const llm = openAIClient(process.env.AZURE_OPENAI_LLM_DEPLOYMENT_ID, {
      callbacks,
    });
    const weaviate = await weaviateVectorStore(
      { indexName, textKey, attributes },
      llm
    );

    const prompt = new PromptTemplate({
      template: promptTemplate(),
      inputVariables: ["question", "context"],
    });

    const template = new PromptTemplate({
      template: documentTemplate(attributes),
      inputVariables: [...attributes, "pageContent", "source"],
    });

    docs = await getDocs(weaviate, question, 10);
    debug("docs", docs);

    multipart.newPart({
      "Content-Type": "application/json",
      "X-Content-Purpose": "context",
      "X-Stream": false,
    });
    multipart.write(JSON.stringify({ question, docs }));

    multipart.newPart({
      "Content-Type": "text/plain",
      "X-Content-Purpose": "answer",
      "X-Stream": true,
    });
    const chain = loadQAStuffChain(llm, {
      documentPrompt: template,
      documentVariableName: "context",
      prompt,
    });

    const input_documents = (
      await Promise.all(docs.map((doc) => template.format(doc)))
    ).map((pageContent) => {
      return { pageContent };
    });
    debug("Asking", question);
    await chain.call({ question, input_documents });
  } catch (err) {
    console.error("error", err);
    return handleError(err);
  }
};

function extractAttributes(event, exclude = []) {
  let result =
    //event.queryStringParameters?.attributes?.split(/\s*,\s*/) ||
    DefaultAttributes;
  const excludeSet = new Set(exclude);
  const resultSet = new Set([...result].filter((x) => !excludeSet.has(x)));
  return [...resultSet];
}

function openAIClient(deployment, { callbacks }) {
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

async function getDocs(weaviate, question, k = 4) {
  const response = await weaviate.client.graphql
    .get()
    .withClassName(weaviate.indexName)
    .withNearText({ concepts: [question] })
    .withFields(`${weaviate.queryAttrs.join(" ")} _additional { certainty }`)
    .withLimit(k)
    .do();

  const result = [];
  for (const hit of response.data.Get[weaviate.indexName]) {
    const pageContent = hit[weaviate.textKey];
    result.push({ pageContent, ...hit });
  }
  return result;
}

function handleError(err) {
  if (err.response) {
    return {
      statusCode: err.response.status,
      headers: err.response.headers,
      body: JSON.stringify(err.response.data),
    };
  }

  return {
    statusCode: 500,
    headers: { "Content-Type": "text/plain" },
    body: err.toString(),
  };
}

exports.handler = streamifyResponse(handler);
