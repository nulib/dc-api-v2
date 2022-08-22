"use strict";

const {
  baseUrl,
  decodeEventBody,
  normalizeHeaders,
} = require("../../../src/helpers");
const chai = require("chai");
const expect = chai.expect;

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
        rawPath: "/v2/route/value",
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
      };

      expect(baseUrl(event)).to.eq(
        "https://abcdefghijz.execute-api.us-east-1.amazonaws.com/v2/"
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
        .pathPrefix("/api/v2")
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
});
