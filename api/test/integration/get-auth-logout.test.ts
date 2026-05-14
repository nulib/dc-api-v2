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
import { ApiToken } from "../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  cookieValue,
} from "../test-helpers/index.ts";

describe("auth logout", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => setupEnv());
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("logs a user out of NU WebSSO and expires the DC API Token", async () => {
    const url = "https://test.com/northwestern#logout";
    server.use(
      http.get("https://nusso-base.com/logout", () =>
        HttpResponse.json({ url }),
      ),
    );

    const token = await new ApiToken().provider("nusso").sign();
    const req = buildRequest("GET", "/auth/logout", {
      headers: {
        cookie: `${process.env["API_TOKEN_NAME"]}=${token}`,
      },
    });

    const result = await sendRequest(req);

    expect(result.status).toEqual(302);
    expect(result.headers.get("location")).toEqual(url);

    const dcApiCookie = cookieValue(
      result.headers.getSetCookie(),
      process.env["API_TOKEN_NAME"]!,
    );

    const apiToken = await ApiToken.create(dcApiCookie.value);
    expect(apiToken.token.sub).toEqual(undefined);
    expect(apiToken.token.isLoggedIn).toEqual(false);
    expect(dcApiCookie.Expires).toEqual("Thu, 01 Jan 1970 00:00:00 GMT");
  });

  describe("non-NUSSO Logout", () => {
    let token: string;

    beforeEach(async () => {
      token = await new ApiToken().provider("test-provider").sign();
    });

    it("expires the DC API Token", async () => {
      const req = buildRequest("GET", "/auth/logout", {
        headers: {
          cookie: `${process.env["API_TOKEN_NAME"]}=${token}`,
        },
      });

      const result = await sendRequest(req);
      const dcApiCookie = cookieValue(
        result.headers.getSetCookie(),
        process.env["API_TOKEN_NAME"]!,
      );

      const apiToken = await ApiToken.create(dcApiCookie.value);
      expect(apiToken.token.sub).toEqual(undefined);
      expect(apiToken.token.isLoggedIn).toEqual(false);
      expect(dcApiCookie.Expires).toEqual("Thu, 01 Jan 1970 00:00:00 GMT");
    });

    it("redirects to the goto URL", async () => {
      const req = buildRequest("GET", "/auth/logout", {
        queryParams: { goto: "http://example.edu/logged-out" },
        headers: {
          cookie: `${process.env["API_TOKEN_NAME"]}=${token}`,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(302);
      expect(result.headers.get("location")).toEqual(
        "http://example.edu/logged-out",
      );
    });

    it("redirects to the referer", async () => {
      const req = buildRequest("GET", "/auth/logout", {
        headers: {
          cookie: `${process.env["API_TOKEN_NAME"]}=${token}`,
          Referer: "http://example.edu/logged-out",
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(302);
      expect(result.headers.get("location")).toEqual(
        "http://example.edu/logged-out",
      );
    });

    it("redirects to the default location", async () => {
      const req = buildRequest("GET", "/auth/logout", {
        headers: {
          cookie: `${process.env["API_TOKEN_NAME"]}=${token}`,
        },
      });
      const result = await sendRequest(req);
      expect(result.status).toEqual(302);
      expect(result.headers.get("location")).toEqual(
        "https://thisisafakedcurl",
      );
    });
  });
});
