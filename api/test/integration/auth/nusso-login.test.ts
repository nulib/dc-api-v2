import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "bun:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
} from "../../test-helpers/index.ts";

describe("auth login", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    setupEnv({ NUSSO_BASE_URL: "https://test-nusso.com/" });
    server.use(
      http.get("https://test-nusso.com/get-ldap-redirect-url", () =>
        HttpResponse.json({ redirecturl: "https://test-redirect.com" }),
      ),
    );
  });
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("redirects to the NUSSO url", async () => {
    const req = buildRequest("GET", "/auth/login/nusso", {
      pathParams: { provider: "nusso", stage: "login" },
      queryParams: { goto: "https://test-goto.com" },
    });

    const result = await sendRequest(req);
    expect(result.status).toEqual(302);
    expect(result.headers.get("location")).toEqual("https://test-redirect.com");
  });

  it("defaults to the NUSSO url", async () => {
    const req = buildRequest("GET", "/auth/login", {
      pathParams: { stage: "login" },
      queryParams: { goto: "https://test-goto.com" },
    });

    const result = await sendRequest(req);
    expect(result.status).toEqual(302);
    expect(result.headers.get("location")).toEqual("https://test-redirect.com");
  });
});
