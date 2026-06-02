import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { SignJWT } from "jose";
import { ApiToken } from "../../../src/api/api-token.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";

async function signPayload(payload: Record<string, unknown>): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("abc123"));
}

describe("ApiToken", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  describe("constructor", () => {
    it("constructs an anonymous token by default", () => {
      const token = new ApiToken();
      expect(token.token.sub).toEqual(undefined);
      expect(token.token.isReadingRoom).toEqual(undefined);
      expect(token.token.isSuperUser).toEqual(undefined);
      expect(token.token.isLoggedIn).toEqual(false);
      expect(token.token.provider).toEqual(undefined);
      expect(token.token.entitlements.size).toEqual(0);
      expect(token.isInstitution()).toEqual(false);
    });

    it("verifies an existing token", async () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        name: "Some One",
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        iat: Math.floor(Date.now() / 1000),
        email: "user@example.com",
        isLoggedIn: true,
        provider: "test-provider",
        entitlements: ["1234", "5678"],
        isReadingRoom: true,
      };
      const existingToken = await signPayload(payload);
      const token = await ApiToken.create(existingToken);

      expect(token.token.sub).toEqual("user123");
      expect(token.token.isReadingRoom).toEqual(true);
      expect(token.token.isLoggedIn).toEqual(true);
      expect(token.token.provider).toEqual("test-provider");
      expect(token.isInstitution()).toEqual(false);
      expect(token.hasEntitlement("1234")).toEqual(true);
    });
  });

  describe("user()", () => {
    it("updates the user properties", () => {
      const user = {
        sub: "user123",
        name: "Some One",
        email: "user@example.com",
      };
      const token = new ApiToken();
      expect(token.token.sub).toEqual(undefined);

      token.user(user);
      expect(token.token.sub).toEqual("user123");
      expect(token.token.name).toEqual("Some One");
      expect(token.token.email).toEqual("user@example.com");
      expect(token.isLoggedIn()).toEqual(true);
    });
  });

  describe("provider()", () => {
    it("sets the provider property", () => {
      const token = new ApiToken();
      expect(token.token.provider).toEqual(undefined);
      expect(token.isInstitution()).toEqual(false);
      expect(token.isLoggedIn()).toEqual(false);

      token.provider("test-provider");
      expect(token.token.provider).toEqual("test-provider");
      expect(token.isInstitution()).toEqual(false);
    });

    it("sets the provider property to an institution provider", () => {
      const token = new ApiToken();
      token.provider("nusso");
      expect(token.token.provider).toEqual("nusso");
      expect(token.isInstitution()).toEqual(true);
    });
  });

  describe("readingRoom()", () => {
    it("sets the isReadingRoom flag to true", () => {
      const token = new ApiToken().readingRoom();
      expect(token.isReadingRoom()).toEqual(true);
    });
  });

  describe("superUser()", () => {
    it("sets the isSuperUser flag to true", () => {
      const token = new ApiToken().superUser();
      expect(token.isSuperUser()).toEqual(true);
    });
  });

  describe("isDevTeam", () => {
    it("sets the isDevTeam flag to true", () => {
      const user = {
        sub: "abc123",
        name: "A. Developer",
        email: "user@example.com",
      };
      const token = new ApiToken();
      token.user(user);
      expect(token.isDevTeam()).toEqual(true);
      expect(token.isLoggedIn()).toEqual(true);
    });
  });

  describe("entitlements", () => {
    it("addEntitlement() adds an entitlement to the token", async () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        iat: Math.floor(Date.now() / 1000),
        isLoggedIn: true,
        entitlements: ["1234"],
      };
      const existingToken = await signPayload(payload);
      const token = await ApiToken.create(existingToken);
      expect(token.hasEntitlement("1234")).toEqual(true);
      expect(token.hasEntitlement("5678")).toEqual(false);

      token.addEntitlement("5678");
      expect(token.hasEntitlement("1234")).toEqual(true);
      expect(token.hasEntitlement("5678")).toEqual(true);
    });

    it("entitlements() replaces entitlements", async () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        iat: Math.floor(Date.now() / 1000),
        isLoggedIn: true,
        entitlements: ["1234"],
      };
      const existingToken = await signPayload(payload);
      const token = await ApiToken.create(existingToken);
      expect(token.hasEntitlement("1234")).toEqual(true);

      token.entitlements(["5678", "9101112"]);
      expect(token.hasEntitlement("1234")).toEqual(false);
      expect(token.hasEntitlement("5678")).toEqual(true);
    });

    it("removeEntitlement() removes an entitlement", async () => {
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        iat: Math.floor(Date.now() / 1000),
        isLoggedIn: true,
        entitlements: ["1234", "5678"],
      };
      const existingToken = await signPayload(payload);
      const token = await ApiToken.create(existingToken);
      expect(token.hasEntitlement("1234")).toEqual(true);
      expect(token.hasEntitlement("5678")).toEqual(true);

      token.removeEntitlement("5678");
      expect(token.hasEntitlement("1234")).toEqual(true);
      expect(token.hasEntitlement("5678")).toEqual(false);
    });
  });

  describe("scopes", () => {
    it("has default scopes", async () => {
      const token = await ApiToken.create();
      expect(token.token.scopes.has("read:Public")).toEqual(true);
      expect(token.token.scopes.has("read:Published")).toEqual(true);
      expect(token.token.scopes.has("read:Private")).toEqual(false);
      expect(token.token.scopes.has("read:Unpublished")).toEqual(false);
    });

    it("addScope() adds a scope", () => {
      const token = new ApiToken();
      expect(token.can("read:Private")).toEqual(false);
      token.addScope("read:Private");
      expect(token.can("read:Private")).toEqual(true);
    });

    it("removeScope() removes a scope", () => {
      const token = new ApiToken();
      token.addScope("read:Private");
      expect(token.can("read:Private")).toEqual(true);
      token.removeScope("read:Private");
      expect(token.can("read:Private")).toEqual(false);
    });

    it("imputes scopes from user", () => {
      const token = new ApiToken();
      token
        .user({
          sub: "user123",
          name: "Some One",
          email: "user123@example.com",
        })
        .provider("nusso");
      expect(token.can("read:Public")).toEqual(true);
      expect(token.can("read:Published")).toEqual(true);
      expect(token.can("read:Private")).toEqual(false);
      expect(token.can("read:Unpublished")).toEqual(false);
      expect(token.can("chat")).toEqual(true);

      const suToken = new ApiToken();
      suToken.superUser();
      expect(suToken.can("read:Public")).toEqual(true);
      expect(suToken.can("read:Published")).toEqual(true);
      expect(suToken.can("read:Private")).toEqual(true);
      expect(suToken.can("read:Unpublished")).toEqual(true);
      expect(suToken.can("chat")).toEqual(true);
    });
  });
});
