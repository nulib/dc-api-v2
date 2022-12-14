"use strict";

const {
  baseUrl,
  decodeEventBody,
  decodeToken,
  isFromReadingRoom,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
} = require("../../../src/helpers");
const chai = require("chai");
const expect = chai.expect;
const ApiToken = require("../../../src/api/api-token");
const jwt = require("jsonwebtoken");

describe("helpers", () => {
  describe("baseUrl()", () => {
    it("extracts the base URL from a local event", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          host: "localhost",
          "x-forwarded-proto": "http",
          "x-forwarded-port": "3000",
        },
        requestContext: {
          domainName: "localhost",
          domainPrefix: "localhost",
          stage: "v2",
        },
      };

      expect(baseUrl(event)).to.eq("http://localhost:3000/");
    });

    it("extracts the base URL from an API Gateway event", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/api/v2/route/value",
        headers: {
          host: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
          "x-forwarded-proto": "https",
          "x-forwarded-port": "443",
        },
        requestContext: {
          domainName: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
          domainPrefix: "abcdefghijz",
          stage: "v2",
        },
        stageVariables: "api/v2",
      };

      expect(baseUrl(event)).to.eq(
        "https://abcdefghijz.execute-api.us-east-1.amazonaws.com/api/v2/"
      );
    });

    it("extracts the base URL from a CloudWatch event", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          host: "abcdefghijz.cloudfront.net",
          "x-forwarded-proto": "https",
          "x-forwarded-port": "443",
        },
        requestContext: {
          domainName: "abcdefghijz.cloudfront.net",
          domainPrefix: "abcdefghijz",
          stage: "v2",
        },
      };

      expect(baseUrl(event)).to.eq("https://abcdefghijz.cloudfront.net/");
    });

    it("extracts the base URL from an event with a custom domain", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          host: "api.test.library.northwestern.edu",
          "x-forwarded-proto": "https",
          "x-forwarded-port": "443",
        },
        requestContext: {
          domainName: "api.test.library.northwestern.edu",
          domainPrefix: "api",
          stage: "v2",
        },
      };

      expect(baseUrl(event)).to.eq(
        "https://api.test.library.northwestern.edu/"
      );
    });

    it("prefers a custom domain over localhost", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          host: "localhost",
          "x-forwarded-proto": "http",
          "x-forwarded-port": "3000",
        },
        requestContext: {
          domainName: "api.test.library.northwestern.edu",
          domainPrefix: "api",
          stage: "v2",
        },
      };

      expect(baseUrl(event)).to.eq(
        "http://api.test.library.northwestern.edu:3000/"
      );
    });

    it("properly handles a base path mapping", () => {
      const event = helpers
        .mockEvent("GET", "/works/{id}")
        .pathParams({ id: 1234 })
        .stageVariables({ basePath: "api/v2" })
        .render();

      expect(baseUrl(event)).to.eq(
        "https://api.test.library.northwestern.edu/api/v2/"
      );
    });
  });

  describe("decodeEventBody()", () => {
    it("passes plain text body through unaltered", () => {
      const event = helpers
        .mockEvent("POST", "/search")
        .body("plain body")
        .render();
      const result = decodeEventBody(event);
      expect(result.isBase64Encoded).to.be.false;
      expect(result.body).to.eq("plain body");
    });

    it("decodes base64 encoded body", () => {
      const event = helpers
        .mockEvent("POST", "/search")
        .body("encoded body")
        .base64Encode()
        .render();
      expect(event.isBase64Encoded).to.be.true;
      expect(event.body).not.to.eq("encoded body");

      const result = decodeEventBody(event);
      expect(result.isBase64Encoded).to.be.false;
      expect(result.body).to.eq("encoded body");
    });
  });

  describe("isFromReadingRoom()", () => {
    helpers.saveEnvironment();

    it("knows when a request is coming from a reading room IP", () => {
      const event = helpers.mockEvent("GET", "/search").render();
      expect(isFromReadingRoom(event)).to.be.false;
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;
      expect(isFromReadingRoom(event)).to.be.true;
    });
  });

  describe("normalizeHeaders()", () => {
    it("converts all headers to lowercase", () => {
      const upperHeaders = ["Host", "X-Forwarded-For", "X-Forwarded-Proto"];
      const lowerHeaders = ["host", "x-forwarded-for", "x-forwarded-proto"];

      const event = helpers.mockEvent("GET", "/search").render();
      expect(event.headers).not.to.include.keys(lowerHeaders);
      expect(event.headers).to.include.keys(upperHeaders);

      const result = normalizeHeaders(event);
      expect(result.headers).to.include.keys(lowerHeaders);
      expect(result.headers).not.to.include.keys(upperHeaders);
    });
  });

  describe("objectifyCookies", () => {
    it("works when there are no cookies", () => {
      const event = helpers.mockEvent("GET", "/search").render();
      const result = objectifyCookies(event);
      expect(result.cookies).to.be.undefined;
      expect(result.cookieObject).to.be.empty;
    });

    it("works when there are cookies", () => {
      const event = helpers
        .mockEvent("GET", "/search")
        .cookie("testName", "works when there are cookies")
        .cookie("cookieType", "snickerdoodle")
        .render();
      const result = objectifyCookies(event);
      expect(result.cookieObject).to.include({
        testName: "works%20when%20there%20are%20cookies",
        cookieType: "snickerdoodle",
      });
    });
  });

  describe("decodeToken", async () => {
    it("adds the decoded token to the event", () => {
      const token = new ApiToken().user({ uid: "abc123" }).sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      let result = objectifyCookies(event);
      result = decodeToken(event);
      expect(result.userToken.token).to.include({
        sub: "abc123",
      });
      expect(result.userToken.token).to.not.have.property("isReadingRoom");
    });
    it("adds an anonymous token to the event if the token is expired", () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        name: "Some One",
        exp: Math.floor(Number(new Date()) / 1000),
        iat: Math.floor(Number(new Date()) / 1000),
        email: "user@example.com",
      };
      const token = jwt.sign(payload, process.env.API_TOKEN_SECRET);

      const event = helpers
        .mockEvent("GET", "/works/{id}/")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      let result = objectifyCookies(event);
      result = decodeToken(event);
      expect(result.userToken.token).to.not.include({
        sub: "abc123",
      });
    });
    it("adds the reading room flag to the token", () => {
      const token = new ApiToken().user({ uid: "abc123" }).sign();

      const event = helpers
        .mockEvent("GET", "/works/{id}/")
        .pathParams({ id: 1234 })
        .headers({
          Cookie: `${process.env.API_TOKEN_NAME}=${token}`,
        })
        .render();
      process.env.READING_ROOM_IPS = event.requestContext.http.sourceIp;

      let result = objectifyCookies(event);
      result = decodeToken(event);
      expect(result.userToken.token).to.include({
        sub: "abc123",
      });
      expect(result.userToken.token.isReadingRoom).to.be.true;
    });
  });

  describe("stubEventMembers", () => {
    it("makes sure the event has all expected members", () => {
      const result = stubEventMembers({});
      expect(result.cookies).to.eql([]);
      expect(result.pathParameters).to.eql({});
      expect(result.queryStringParameters).to.eql({});
    });
  });
});
