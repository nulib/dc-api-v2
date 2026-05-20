import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
  spyOn,
} from "bun:test";
import { setupServer } from "msw/node";
import Honeybadger from "@honeybadger-io/js";
import { buildRequest, setupEnv, teardownEnv } from "../test-helpers/index.ts";
import app from "../../src/app.ts";

describe("middleware", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    setupEnv();
    delete process.env["HONEYBADGER_DISABLED"];
  });
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
    process.env["HONEYBADGER_DISABLED"] = "true";
  });
  afterAll(() => server.close());

  it("reports uncaught errors to Honeybadger", async () => {
    let notifiedError: Error | undefined;
    const notifySpy = spyOn(
      Honeybadger as { notifyAsync?: (e: unknown) => Promise<void> },
      "notifyAsync",
    ).mockImplementation(async (error: unknown) => {
      notifiedError = error as Error;
    });

    const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Simulated fetch failure"),
    );

    try {
      const req = buildRequest("GET", "/works/abc-123");
      const result = await app.request(req);
      expect(result.status).toEqual(400);
      expect(notifiedError).toBeDefined();
    } finally {
      fetchSpy.mockRestore();
      notifySpy.mockRestore();
    }
  });
});
