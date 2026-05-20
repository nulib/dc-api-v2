import { describe, it, beforeEach, afterEach, expect, mock } from "bun:test";
import { createMagicToken } from "../../../src/handlers/auth/magic-link.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../../test-helpers/index.ts";

const mockSend = mock(() => Promise.resolve({}));

mock.module("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = mockSend;
  },
  SendTemplatedEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe("Magic link login", () => {
  beforeEach(() => {
    setupEnv({
      API_TOKEN_SECRET: "TEST_SECRET",
      DC_API_ENDPOINT: "https://api.example.edu/",
      DC_URL: "https://dc.example.edu/",
      MAGIC_LINK_EMAIL_TEMPLATE: "magic-link-template",
      REPOSITORY_EMAIL: "email@example.edu",
    });
    mockSend.mockClear();
  });

  afterEach(() => {
    teardownEnv();
  });

  it("should return 200 and send a magic link email", async () => {
    const req = buildRequest("GET", "/auth/login/magic", {
      pathParams: { provider: "magic", stage: "login" },
      queryParams: {
        email: "user@example.edu",
        goto: "https://dc.example.edu/items/1234",
      },
    });
    const result = await sendRequest(req);
    expect(mockSend.mock.calls.length).toEqual(1);
    expect(result.status).toEqual(200);
    const body = await result.json();
    expect(body.message).toEqual("Magic link sent");
    expect(body.email).toEqual("user@example.edu");
  });

  it("should return 400 if email is not provided", async () => {
    const req = buildRequest("GET", "/auth/login/magic", {
      pathParams: { provider: "magic", stage: "login" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(400);
    const body = await result.json();
    expect(body.error).toEqual("Email is required");
  });
});

describe("Magic link callback", () => {
  beforeEach(() => {
    setupEnv({
      API_TOKEN_SECRET: "TEST_SECRET",
    });
  });

  afterEach(() => {
    teardownEnv();
  });

  it("should issue a 302 redirect to the goto URL", async () => {
    const { token } = await createMagicToken(
      "user@example.edu",
      "https://dc.example.edu/items/1234",
    );

    const req = buildRequest("GET", "/auth/callback/magic", {
      pathParams: { provider: "magic", stage: "callback" },
      queryParams: { token },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(302);
    expect(result.headers.get("location")).toEqual(
      "https://dc.example.edu/items/1234",
    );
  });

  it("should return 400 if token is not provided", async () => {
    const req = buildRequest("GET", "/auth/callback/magic", {
      pathParams: { provider: "magic", stage: "callback" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(400);
    const body = await result.json();
    expect(body.error).toEqual("Missing token");
  });

  it("should return 401 if token is invalid", async () => {
    const req = buildRequest("GET", "/auth/callback/magic", {
      pathParams: { provider: "magic", stage: "callback" },
      queryParams: { token: "invalid-token" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(401);
    const body = await result.json();
    expect(body.error).toEqual("Invalid token signature");
  });

  it("should return 401 if token is expired", async () => {
    const { token } = await createMagicToken(
      "user@example.edu",
      "https://dc.example.edu/items/1234",
      Date.now() - 1000 * 60 * 60,
    );
    const req = buildRequest("GET", "/auth/callback/magic", {
      pathParams: { provider: "magic", stage: "callback" },
      queryParams: { token },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(401);
    const body = await result.json();
    expect(body.error).toEqual("Token expired");
  });
});

describe("auth login with Magic Link disabled", () => {
  beforeEach(() => {
    setupEnv({
      PROVIDER_CAPABILITIES: '{"magic":[],"nusso":["chat", "login"]}',
    });
  });

  afterEach(() => {
    teardownEnv();
  });

  it("returns a 404 when Magic Link is disabled", async () => {
    const req = buildRequest("GET", "/auth/login/magic", {
      pathParams: { provider: "magic", stage: "login" },
    });
    const result = await sendRequest(req);
    expect(result.status).toEqual(404);
  });
});
