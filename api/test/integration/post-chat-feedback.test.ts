import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../test-helpers/index.ts";

const s3Mock = mockClient(S3Client);
const snsMock = mockClient(SNSClient);

describe("Chat feedback route", () => {
  beforeEach(() => {
    setupEnv();
    s3Mock.reset();
    snsMock.reset();
  });

  afterEach(() => {
    teardownEnv();
  });

  describe("Form POST submission", () => {
    beforeEach(() => {
      s3Mock.on(PutObjectCommand).resolves({});
      snsMock.on(PublishCommand).resolves({});
    });

    it("should return 401 if user is not logged in", async () => {
      const requestBody = JSON.stringify({
        sentiment: "positive",
        timestamp: new Date().toISOString(),
        ref: "5a6e1d76-0d4c-43c5-ab2c-4687112ba102",
        refIndex: 0,
        context: {
          ref: "5a6e1d76-0d4c-43c5-ab2c-4687112ba102",
          initialQuestion: "What is the capital of France?",
          turns: [
            {
              question: "What is the capital of France?",
              answer: "Paris",
              works: [],
              aggregations: [],
            },
          ],
        },
        feedback: {
          options: [],
          text: "",
          email: "",
        },
      });

      const req = buildRequest("POST", "/chat/feedback", {
        body: requestBody,
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(401);
      expect(await result.text()).toEqual("Authorization Required");
    });

    it("should fail if sentiment is invalid", async () => {
      const token = await new ApiToken().user({ sub: "abc123" }).sign();

      const requestBody = JSON.stringify({
        sentiment: "neutral",
        timestamp: new Date().toISOString(),
        ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
        refIndex: 0,
        context: {
          ref: "3fc98004-995b-4491-94fd-aea48a0363ba",
          initialQuestion: "What is the capital of France?",
          turns: [
            {
              question: "What is the capital of France?",
              answer: "Paris",
              works: [],
              aggregations: [],
            },
          ],
        },
        feedback: {
          options: [],
          text: "",
          email: "",
        },
      });

      const req = buildRequest("POST", "/chat/feedback", {
        body: requestBody,
        headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(await result.text()).toEqual(
        "sentiment is not one of enum values: positive,negative",
      );
    });

    it("should fail if ref is missing", async () => {
      const token = await new ApiToken().user({ sub: "abc123" }).sign();
      const requestBody = JSON.stringify({
        sentiment: "positive",
        timestamp: new Date().toISOString(),
        // ref is omitted
        refIndex: 0,
        context: {
          ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
          initialQuestion: "Hello?",
          turns: [
            {
              question: "Hello?",
              answer: "World",
              works: [],
              aggregations: [],
            },
          ],
        },
        feedback: {
          options: [],
          text: "",
          email: "",
        },
      });
      const req = buildRequest("POST", "/chat/feedback", {
        body: requestBody,
        headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(await result.text()).toEqual(`instance requires property "ref"`);
    });

    it("should fail if refIndex is missing", async () => {
      const token = await new ApiToken().user({ sub: "abc123" }).sign();
      const requestBody = JSON.stringify({
        sentiment: "positive",
        timestamp: new Date().toISOString(),
        ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
        // refIndex is omitted
        context: {
          ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
          initialQuestion: "Hello?",
          turns: [
            {
              question: "Hello?",
              answer: "World",
              works: [],
              aggregations: [],
            },
          ],
        },
        feedback: {
          options: [],
          text: "",
          email: "",
        },
      });
      const req = buildRequest("POST", "/chat/feedback", {
        body: requestBody,
        headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(await result.text()).toEqual(
        `instance requires property "refIndex"`,
      );
    });

    it("should fail if timestamp is missing", async () => {
      const token = await new ApiToken().user({ sub: "abc123" }).sign();
      const requestBody = JSON.stringify({
        sentiment: "positive",
        // timestamp is omitted
        ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
        refIndex: 0,
        context: {
          ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
          initialQuestion: "Hello?",
          turns: [
            {
              question: "Hello?",
              answer: "World",
              works: [],
              aggregations: [],
            },
          ],
        },
        feedback: {
          options: [],
          text: "",
          email: "",
        },
      });
      const req = buildRequest("POST", "/chat/feedback", {
        body: requestBody,
        headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(400);
      expect(await result.text()).toEqual(
        `instance requires property "timestamp"`,
      );
    });

    describe("Saving feedback", () => {
      it("should upload the response to S3 and return 200", async () => {
        const token = await new ApiToken().user({ sub: "abc123" }).sign();

        const requestBody = {
          sentiment: "negative",
          timestamp: new Date().toISOString(),
          ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
          refIndex: 0,
          context: {
            ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
            initialQuestion: "What is the capital of France?",
            turns: [
              {
                question: "What is the capital of France?",
                answer: "Rome",
                works: [],
                aggregations: [],
              },
            ],
          },
          feedback: {
            options: ["option1"],
            text: "Bad answer!",
            email: "example@example.com",
          },
        };

        const req = buildRequest("POST", "/chat/feedback", {
          body: JSON.stringify(requestBody),
          headers: { cookie: `${process.env["API_TOKEN_NAME"]}=${token}` },
        });

        const result = await sendRequest(req);

        expect(result.status).toEqual(200);
        expect(await result.text()).toEqual(
          '{"message":"Feedback received. Thank you."}',
        );

        const s3Calls = s3Mock.calls();
        expect(s3Calls.length).toEqual(1);
        // In aws-sdk-client-mock, each call's args[0] is the Command instance with .input
        const s3CommandInput = (
          s3Calls[0].args[0] as unknown as { input: Record<string, unknown> }
        ).input;
        expect(s3CommandInput.Bucket).toEqual(
          process.env["CHAT_FEEDBACK_BUCKET"],
        );
        expect(s3CommandInput.Key).toEqual(
          "negative/e6005d7c-e03b-43f7-94a3-e327b4b5a538_0.json",
        );
        expect(s3CommandInput.ContentType).toEqual("application/json");

        const snsCalls = snsMock.calls();
        expect(snsCalls.length).toEqual(1);
      });
    });
  });
});
