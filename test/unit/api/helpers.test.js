"use strict";

const { baseUrl, getHeader } = require("../../../src/helpers");
const chai = require("chai");
const expect = chai.expect;

describe("helpers", () => {
  describe("baseUrl()", () => {
    it("extracts the base URL from a local event", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          Host: "localhost",
          "X-Forwarded-Proto": "http",
          "X-Forwarded-Port": "3000",
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
          Host: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Port": "443",
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
          Host: "abcdefghijz.cloudfront.net",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Port": "443",
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
          Host: "api.test.library.northwestern.edu",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Port": "443",
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
          Host: "localhost",
          "X-Forwarded-Proto": "http",
          "X-Forwarded-Port": "3000",
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

  describe("getHeader()", () => {
    it("extracts event headers regardless of case", () => {
      const event = {
        routeKey: "GET /route/{param}",
        rawPath: "/route/value",
        headers: {
          Host: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
          "X-Forwarded-Proto": "https",
          "x-forwarded-port": "443",
        },
        requestContext: {
          domainName: "abcdefghijz.execute-api.us-east-1.amazonaws.com",
          domainPrefix: "abcdefghijz",
          stage: "v2",
        },
      };

      expect(getHeader(event, "X-Forwarded-Proto")).to.eq("https");
      expect(getHeader(event, "X-Forwarded-Port")).to.eq("443");
    });
  });
});
