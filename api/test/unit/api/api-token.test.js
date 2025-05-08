"use strict";

const chai = require("chai");
const expect = chai.expect;
const jwt = require("jsonwebtoken");

const ApiToken = requireSource("api/api-token");

describe("ApiToken", function () {
  helpers.saveEnvironment();

  describe("constructor", function () {
    it("constructs an anonymous token by default", async () => {
      const token = new ApiToken();
      expect(token.token.sub).to.not.exist;
      expect(token.token.isReadingRoom).to.not.exist;
      expect(token.token.isSuperUser).to.not.exist;
      expect(token.token.isLoggedIn).to.be.false;
      expect(token.token.provider).to.not.exist;
      expect(token.token.entitlements).to.be.empty;
      expect(token.isInstitution()).to.be.false;
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
        provider: "test-provider",
        entitlements: ["1234", "5678"],
        isReadingRoom: true,
      };
      const existingToken = jwt.sign(payload, process.env.API_TOKEN_SECRET);
      const token = new ApiToken(existingToken);

      expect(token.token.sub).to.eq("user123");
      expect(token.token.isReadingRoom).to.be.true;
      expect(token.token.isLoggedIn).to.be.true;
      expect(token.token.provider).to.eq("test-provider");
      expect(token.isInstitution()).to.be.false;
      expect(token.hasEntitlement("1234")).to.be.true;
    });
  });

  describe("user()", function () {
    it("updates the user properties", async () => {
      const user = {
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      };

      const token = new ApiToken();
      expect(token.token.sub).to.not.exist;

      token.user(user);
      expect(token.token.sub).to.eq("user123");
      expect(token.token.name).to.eq("Some One");
      expect(token.token.email).to.eq("user@example.com");
      expect(token.isLoggedIn()).to.be.true;
    });
  });

  describe("provider()", function () {
    it("sets the provider property", async () => {
      const token = new ApiToken();
      expect(token.token.provider).to.not.exist;
      expect(token.isInstitution()).to.be.false;
      expect(token.isLoggedIn()).to.be.false;

      token.provider("test-provider");
      expect(token.token.provider).to.eq("test-provider");
      expect(token.isInstitution()).to.be.false;
    });

    it("sets the provider property to an institution provider", async () => {
      const token = new ApiToken();
      expect(token.token.provider).to.not.exist;
      expect(token.isInstitution()).to.be.false;
      expect(token.isLoggedIn()).to.be.false;

      token.provider("nusso");
      expect(token.token.provider).to.eq("nusso");
      expect(token.isInstitution()).to.be.true;
    });
  });

  describe("readingRoom()", function () {
    it("sets the isReadingRoom flag to true", async () => {
      const token = new ApiToken().readingRoom();
      expect(token.isReadingRoom()).to.be.true;
    });
  });

  describe("superUser()", function () {
    it("sets the isSuperUser flag to true", async () => {
      const token = new ApiToken().superUser();
      expect(token.isSuperUser()).to.be.true;
    });
  });

  describe("isDevTeam", function () {
    it("sets the isDevTeam flag to true", async () => {
      const user = {
        sub: "abc123",
        name: "A. Developer",
        email: "user@example.com",
      };
      const token = new ApiToken();
      token.user(user);

      expect(token.isDevTeam()).to.be.true;
      expect(token.isLoggedIn()).to.be.true;
    });
  });

  describe("entitlements", function () {
    it("addEntitlement() adds an entitlement to the token", async () => {
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

  describe("abilities", function () {
    it("has default abilities", async () => {
      const token = new ApiToken();
      expect(token.token.abilities.has("read:Public")).to.be.true;
      expect(token.token.abilities.has("read:Published")).to.be.true;
      expect(token.token.abilities.has("read:Private")).to.be.false;
      expect(token.token.abilities.has("read:Unpublished")).to.be.false;
    });

    it("addAbility() adds an ability", async () => {
      const token = new ApiToken();
      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;
      expect(token.can("read:Private")).to.be.false;

      token.addAbility("read:Private");

      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;
      expect(token.can("read:Private")).to.be.true;
    });

    it("removeAbility() removes an ability", async () => {
      const token = new ApiToken();
      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;

      token.addAbility("read:Private");
      expect(token.can("read:Private")).to.be.true;

      token.removeAbility("read:Private");
      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;
      expect(token.can("read:Private")).to.be.false;
    });

    it("imputes abilities from user", async () => {
      const token = new ApiToken();
      token.user({
        sub: "user123",
        name: "Some One",
        email: "user123@example.com",
      });
      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;
      expect(token.can("read:Private")).to.be.false;
      expect(token.can("read:Unpublished")).to.be.false;
      expect(token.can("chat")).to.be.true;

      token.superUser();
      expect(token.can("read:Public")).to.be.true;
      expect(token.can("read:Published")).to.be.true;
      expect(token.can("read:Private")).to.be.true;
      expect(token.can("read:Unpublished")).to.be.true;
      expect(token.can("chat")).to.be.true;
    });
  });
});
