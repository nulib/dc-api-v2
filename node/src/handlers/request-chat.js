const debug = require("debug")("api.request-chat");
const MultiPartStream = require("../chat/multipart");
const { __processRequest, __processResponse } = require("./middleware");
const {
  DefaultAttributes,
  DefaultIndex,
  DefaultKey,
} = require("../chat/defaults");
const { documentTemplate, promptTemplate } = require("./chat-prompts");
const { loadQAStuffChain } = require("langchain/chains");
const { openAIClient, weaviateVectorStore } = require("../chat/setup");
const { PromptTemplate } = require("langchain/prompts");
const { streamifyResponse, HttpResponseStream } = global.awslambda;

const streamResult = process.env.STREAM === "1";

const handler = async (...args) => {
  const event = __processRequest(args[0]);
  let stream = streamResult ? args[1] : undefined;

  if (!event.userToken.isLoggedIn()) {
    const response = {
      statusCode: 401,
      headers: {
        "Content-Type": "text/plain",
      },
      body: "Unauthorized",
    };
    return send(stream, __processResponse(event, response));
  }

  try {
    let question, docs;
    const multipart = new MultiPartStream(stream);

    question =
      event?.requestContext?.http?.method == "POST"
        ? event.body
        : event.queryStringParameters?.q;
    const indexName = event.queryStringParameters?.index || DefaultIndex;
    const textKey = event.queryStringParameters?.text_key || DefaultKey;
    const attributes = extractAttributes(event, [textKey]);

    const llm = openAIClient(process.env.AZURE_OPENAI_LLM_DEPLOYMENT_ID, {
      multipart,
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
    const completion = await chain.call({ question, input_documents });
    if (streamResult) {
      await new Promise((resolve) => stream.on("finish", resolve));
    } else {
      const body = JSON.stringify({
        question,
        answer: completion,
        source_documents: input_documents,
      });
      return __processResponse(event, {
        headers: { "Content-Type": "application/json" },
        body,
      });
    }
  } catch (err) {
    console.error("error", err);
    throw err;
  }
};

function extractAttributes(event, exclude = []) {
  let result =
    event.queryStringParameters?.attributes?.split(/\s*,\s*/) ||
    DefaultAttributes;
  const excludeSet = new Set(exclude);
  const resultSet = new Set([...result].filter((x) => !excludeSet.has(x)));
  return [...resultSet];
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

function send(stream, response) {
  if (stream) {
    const { body, ...rest } = response;
    stream = HttpResponseStream.from(stream, rest);
    stream.write(body);
    stream.end();
  } else {
    return response;
  }
}

exports.handler = streamResult ? streamifyResponse(handler) : handler;
