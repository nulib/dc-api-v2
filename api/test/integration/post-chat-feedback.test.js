const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));
const ApiToken = requireSource("api/api-token");
const { mockClient } = require("aws-sdk-client-mock");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const { handler } = requireSource("handlers/post-chat-feedback");

describe("Chat feedback route", () => {
  helpers.saveEnvironment();
  // Pass in the S3 and SNS clients to the handler
  // to workound an issue with the mocking library
  // https://github.com/m-radzikowski/aws-sdk-client-mock
  const s3Mock = mockClient(S3Client);
  const s3Client = new S3Client({});
  const snsMock = mockClient(SNSClient);
  const snsClient = new SNSClient({});

  beforeEach(() => {
    s3Mock.reset();
    snsMock.reset();
  });

  describe("Form POST submission", () => {
    beforeEach(() => {
      s3Mock.on(PutObjectCommand).resolves({});
      snsMock.on(PublishCommand).resolves({});
    });

    it("should return 401 if user is not logged in", async () => {
      let requestBody = JSON.stringify({
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

      const event = helpers
        .mockEvent("POST", "/chat-feedback")
        .body(requestBody)
        .render();
      const response = await handler(event);
      expect(response.statusCode).to.equal(401);
      expect(response.body).to.equal("Authorization Required");
    });

    it("should fail if sentiment is invalid", async () => {
      const token = new ApiToken().user({ sub: "abc123" }).sign();

      let requestBody = JSON.stringify({
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

      const event = helpers
        .mockEvent("POST", "/chat-feedback")
        .body(requestBody)
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const response = await handler(event);
      expect(response.statusCode).to.equal(400);
      expect(response.body).to.equal(
        `sentiment is not one of enum values: positive,negative`
      );
    });

    it("should fail if ref is missing", async () => {
      const token = new ApiToken().user({ sub: "abc123" }).sign();
      let requestBody = JSON.stringify({
        sentiment: "positive",
        timestamp: new Date().toISOString(),
        // ... we omit ref here ...
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
      const event = helpers
        .mockEvent("POST", "/chat-feedback")
        .body(requestBody)
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const response = await handler(event);
      expect(response.statusCode).to.equal(400);
      expect(response.body).to.equal(`instance requires property "ref"`);
    });

    it("should fail if refIndex is missing", async () => {
      const token = new ApiToken().user({ sub: "abc123" }).sign();
      let requestBody = JSON.stringify({
        sentiment: "positive",
        timestamp: new Date().toISOString(),
        ref: "e6005d7c-e03b-43f7-94a3-e327b4b5a538",
        // ... we omit refIndex ...
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
      const event = helpers
        .mockEvent("POST", "/chat-feedback")
        .body(requestBody)
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const response = await handler(event);
      expect(response.statusCode).to.equal(400);
      expect(response.body).to.equal(`instance requires property "refIndex"`);
    });

    it("should fail if timestamp is missing", async () => {
      const token = new ApiToken().user({ sub: "abc123" }).sign();
      let requestBody = JSON.stringify({
        sentiment: "positive",
        // ... we omit timestamp ...
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
      const event = helpers
        .mockEvent("POST", "/chat-feedback")
        .body(requestBody)
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      const response = await handler(event);
      expect(response.statusCode).to.equal(400);
      expect(response.body).to.equal(`instance requires property "timestamp"`);
    });

    describe("Saving feedback", () => {
      it("should upload the response to S3 and return 200", async () => {
        const token = new ApiToken().user({ sub: "abc123" }).sign();

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

        const event = helpers
          .mockEvent("POST", "/chat-feedback")
          .body(JSON.stringify(requestBody))
          .headers({
            Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
          })
          .render();

        const response = await handler(event, {
          injections: { s3Client, snsClient },
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.equal(
          '{"message":"Feedback received. Thank you."}'
        );
        expect(s3Mock.calls(PutObjectCommand).length).to.equal(1);
        expect(s3Mock.call(0).args[0].input.Bucket).eq(
          process.env.CHAT_FEEDBACK_BUCKET
        );
        expect(s3Mock.call(0).args[0].input.Key).eq(
          "negative/e6005d7c-e03b-43f7-94a3-e327b4b5a538_0.json"
        );
        expect(s3Mock.call(0).args[0].input.ContentType).eq("application/json");
        expect(JSON.parse(s3Mock.call(0).args[0].input.Body)).to.deep.equal(
          requestBody
        );

        expect(snsMock.calls(PublishCommand).length).to.equal(1);
      });
    });
  });
});
