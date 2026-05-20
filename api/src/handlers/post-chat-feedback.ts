import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Validator } from "jsonschema";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

const feedbackSchema = {
  type: "object",
  properties: {
    sentiment: { enum: ["positive", "negative"] },
    timestamp: { type: "string" },
    ref: { type: "string" },
    refIndex: { type: "number" },
    context: {
      type: "object",
      properties: {
        ref: { type: "string" },
        initialQuestion: { type: "string" },
        turns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              works: {
                type: "array",
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      visibility: { type: "string" },
                      work_type: { type: "string" },
                      thumbnail: { type: "string" },
                    },
                  },
                },
              },
              aggregations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    doc_count_error_upper_bound: { type: "number" },
                    sum_other_doc_count: { type: "number" },
                    buckets: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          doc_count: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
            required: ["question", "answer", "works", "aggregations"],
          },
        },
      },
      required: ["ref", "initialQuestion", "turns"],
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
  required: [
    "sentiment",
    "timestamp",
    "ref",
    "refIndex",
    "context",
    "feedback",
  ],
  additionalProperties: false,
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const userToken = c.get("userToken");
  if (!userToken.isLoggedIn() && !userToken.isSuperUser()) {
    return new Response("Authorization Required", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const s3Client = new S3Client({});
  const snsClient = new SNSClient({});

  try {
    const content = (await req.json()) as Record<string, unknown>;
    const v = new Validator();
    const result = v.validate(content, feedbackSchema);

    const errors = result.errors.map((e) => e.stack.replace("instance.", ""));
    if (errors.length > 0) {
      return new Response(errors.join(", "), {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    await uploadToS3(
      s3Client,
      `${content.sentiment}/${content.ref}_${content.refIndex}.json`,
      content,
    );

    const env =
      process.env["HONEYBADGER_ENV"] || process.env["DEV_PREFIX"] || "dev";
    await sendNotification(
      snsClient,
      `Chat feedback: ${content.sentiment} response (${env})`,
      JSON.stringify(content, null, 2),
    );

    return new Response(
      JSON.stringify({ message: "Feedback received. Thank you." }),
      {
        status: 200,
        headers: { "content-type": "text/plain" },
      },
    );
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }
};

const uploadToS3 = async (s3Client: S3Client, key: string, body: unknown) => {
  const command = new PutObjectCommand({
    Bucket: process.env["CHAT_FEEDBACK_BUCKET"],
    Key: key,
    Body: JSON.stringify(body, null, 2),
    ContentType: "application/json",
  });
  return await s3Client.send(command);
};

const sendNotification = async (
  snsClient: SNSClient,
  subject: string,
  message: string,
) => {
  const command = new PublishCommand({
    TopicArn: process.env["CHAT_FEEDBACK_TOPIC_ARN"],
    Subject: subject,
    Message: message,
  });
  return await snsClient.send(command);
};
