"use strict";

const ApiToken = require("../../../src/api/api-token");
const chai = require("chai");
const expect = chai.expect;
const jwt = require("jsonwebtoken");

describe("ApiToken", function () {
  this.beforeEach(() => {});
  describe("constructor", function () {
    it("constructs an anonymous token by default", async () => {
      const token = new ApiToken();
      expect(token.token.sub).to.not.exist;
      expect(token.token.isReadingRoom).to.not.exist;
      expect(token.token.isSuperUser).to.not.exist;
      expect(token.token.isLoggedIn).to.be.false;
      expect(token.token.entitlements).to.be.empty;
    });

    it("verifies an existing token", async () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        name: "Some One",
        exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
        iat: Math.floor(Number(new Date()) / 1000),
        email: "user@example.com",
        isLoggedIn: true,
        entitlements: ["1234", "5678"],
        isReadingRoom: true,
      };
      const existingToken = jwt.sign(payload, process.env.API_TOKEN_SECRET);
      const token = new ApiToken(existingToken);

      expect(token.token.sub).to.eq("user123");
      expect(token.token.isReadingRoom).to.be.true;
      expect(token.token.isLoggedIn).to.be.true;
      expect(token.hasEntitlement("1234")).to.be.true;
    });
  });
  describe("user()", function () {
    it("updates the user properties", async () => {});

    const user = {
      uid: "user123",
      displayName: ["Some One"],
      mail: "user@example.com",
    };

    const token = new ApiToken();
    expect(token.token.sub).to.not.exist;

    token.user(user);
    expect(token.token.sub).to.eq("user123");
    expect(token.token.name).to.eq("Some One");
    expect(token.token.email).to.eq("user@example.com");
    expect(token.isLoggedIn()).to.be.true;
  });

  describe("readingRoom()", function () {
    it("sets the isReadingRoom flag to true", async () => {});

    const token = new ApiToken().readingRoom();
    expect(token.isReadingRoom()).to.be.true;
  });

  describe("superUser()", function () {
    it("sets the isSuperUser flag to true", async () => {});

    const token = new ApiToken().superUser();
    expect(token.isSuperUser()).to.be.true;
  });

  describe("entitlements", function () {
    it("addEntitlement() adds an entitlement to the token", async () => {});

    const payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
      isLoggedIn: true,
      entitlements: ["1234"],
    };
    const existingToken = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const token = new ApiToken(existingToken);
    expect(token.hasEntitlement("1234")).to.be.true;
    expect(token.hasEntitlement("5678")).to.be.false;

    token.addEntitlement("5678");

    expect(token.hasEntitlement("1234")).to.be.true;
    expect(token.hasEntitlement("5678")).to.be.true;
  });

  it("entitlements() replaces entitlements", async () => {
    const payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
      isLoggedIn: true,
      entitlements: ["1234"],
    };
    const existingToken = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const token = new ApiToken(existingToken);
    expect(token.hasEntitlement("1234")).to.be.true;
    expect(token.hasEntitlement("5678")).to.be.false;

    token.entitlements(["5678", "9101112"]);

    expect(token.hasEntitlement("1234")).to.be.false;
    expect(token.hasEntitlement("5678")).to.be.true;
  });

  it("removeEntitlement() removes an entitlement", async () => {
    const payload = {
      iss: "https://example.com",
      sub: "user123",
      name: "Some One",
      exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
      iat: Math.floor(Number(new Date()) / 1000),
      email: "user@example.com",
      isLoggedIn: true,
      entitlements: ["1234", "5678"],
    };
    const existingToken = jwt.sign(payload, process.env.API_TOKEN_SECRET);

    const token = new ApiToken(existingToken);
    expect(token.hasEntitlement("1234")).to.be.true;
    expect(token.hasEntitlement("5678")).to.be.true;

    token.removeEntitlement("5678");

    expect(token.hasEntitlement("1234")).to.be.true;
    expect(token.hasEntitlement("5678")).to.be.false;
  });
});
