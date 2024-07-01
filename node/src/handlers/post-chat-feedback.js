const { wrap } = require("./middleware");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const Validator = require("jsonschema").Validator;

const feedbackSchema = {
  type: "object",
  properties: {
    sentiment: { enum: ["positive", "negative"] },
    context: {
      type: "object",
      properties: {
        ref: { type: "string" },
        question: { type: "string" },
        answer: { type: "string" },
        source_documents: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["ref", "question", "answer", "source_documents"],
      additionalProperties: false,
    },
    feedback: {
      type: "object",
      properties: {
        options: { type: "array", items: { type: "string" } },
        text: { type: "string" },
        email: { type: "string" },
      },
      required: ["options", "text", "email"],
      additionalProperties: false,
    },
  },
  required: ["sentiment", "context", "feedback"],
  additionalProperties: false,
};

const handler = wrap(async (event, context) => {
  if (!event.userToken.isLoggedIn() && !event.userToken.isSuperUser()) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "text/plain" },
      body: "Authorization Required",
    };
  }

  // Pass in the S3 and SNS clients if they are injected
  // to workound an issue with the mocking library
  // https://github.com/m-radzikowski/aws-sdk-client-mock
  const s3Client = context?.injections?.s3Client
    ? context.injections.s3Client
    : new S3Client({});
  const snsClient = context?.injections?.snsClient
    ? context.injections.snsClient
    : new SNSClient({});

  try {
    const content = JSON.parse(event.body);
    const v = new Validator();
    var result = v.validate(content, feedbackSchema);

    const errors = result.errors.map((e) => e.stack.replace("instance.", ""));
    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(errors.join(", ")),
      };
    }
    await uploadToS3(
      s3Client,
      `${content.sentiment}/${content.context.ref}.json`,
      content
    );

    await sendNotification(
      snsClient,
      `Chat feedback: ${content.sentiment} response (${
        process.env.HONEYBADGER_ENV || process.env.DEV_PREFIX || "dev"
      })`,
      JSON.stringify(content, null, 2)
    );

    return {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({
        message: `Feedback received. Thank you.`,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain" },
      body: "Internal Server Error",
    };
  }
});

const uploadToS3 = async (s3Client, key, body) => {
  const command = new PutObjectCommand({
    Bucket: process.env.CHAT_FEEDBACK_BUCKET,
    Key: key,
    Body: JSON.stringify(body, null, 2),
    ContentType: "application/json",
  });

  return await s3Client.send(command);
};

const sendNotification = async (snsClient, subject, message) => {
  const command = new PublishCommand({
    TopicArn: process.env.CHAT_FEEDBACK_TOPIC_ARN,
    Subject: subject,
    Message: message,
  });
  const response = await snsClient.send(command);
  console.log(response);
  return response;
};

module.exports = { handler };
