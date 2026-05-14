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
import { ApiToken } from "../../../src/api/api-token.ts";
import {
  buildRequest,
  sendRequest,
  setupEnv,
  teardownEnv,
  cookieValue,
} from "../../test-helpers/index.ts";

const NUSSO_BASE_URL = "https://nusso-base.com/";

// The old nusso cookie value `nusso=bnVzc28=` — "bnVzc28=" is btoa("nusso")
// The handler reads ctx.cookies.nusso which is the raw cookie value (url-decoded).
// buildRequest encodes cookie values with encodeURIComponent, so we pass the raw value.
const NUSSO_COOKIE_VALUE = "nusso";

function makeRequest(redirectUrl?: string): Request {
  const cookies: Array<[string, string]> = [["nusso", NUSSO_COOKIE_VALUE]];
  if (redirectUrl) {
    cookies.push(["redirectUrl", btoa(redirectUrl)]);
  }
  return buildRequest("GET", "/auth/callback/nusso", {
    pathParams: { provider: "nusso", stage: "callback" },
    cookies,
  });
}

describe("nusso auth callback", () => {
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    setupEnv({ NUSSO_BASE_URL });
    server.use(
      http.get(
        "https://nusso-base.com/agentless-websso/validateWebSSOToken",
        () => HttpResponse.json({ netid: "uid123" }),
      ),
    );
  });
  afterEach(() => {
    server.resetHandlers();
    teardownEnv();
  });
  afterAll(() => server.close());

  it("redeems the NUSSO token", async () => {
    server.use(
      http.get(
        "https://nusso-base.com/directory-search/res/netid/bas/uid123",
        () =>
          HttpResponse.json({
            results: [
              {
                displayName: ["Some User"],
                mail: "some.user@example.com",
                eduPersonPrimaryAffiliation: "staff",
              },
            ],
          }),
      ),
    );

    const req = makeRequest("https://example.com");
    const result = await sendRequest(req);

    const dcApiCookie = cookieValue(
      result.headers.getSetCookie(),
      process.env["API_TOKEN_NAME"]!,
    );

    const apiToken = await ApiToken.create(dcApiCookie.value);

    expect(apiToken.token.sub).toEqual("uid123");
    expect(apiToken.token.name).toEqual("Some User");
    expect(apiToken.token.email).toEqual("some.user@example.com");
    expect(apiToken.token.primaryAffiliation).toEqual("staff");
    expect(apiToken.isLoggedIn()).toEqual(true);
  });

  it("fills in the blanks if the directory search result is incomplete", async () => {
    server.use(
      http.get(
        "https://nusso-base.com/directory-search/res/netid/bas/uid123",
        () => HttpResponse.json({ results: [{ displayName: [], mail: "" }] }),
      ),
    );

    const req = makeRequest("https://example.com");
    const result = await sendRequest(req);

    const setCookies = result.headers.getSetCookie();
    const hasExpiredRedirectUrl = setCookies.some(
      (c) =>
        c.startsWith("redirectUrl=") && c.includes("Expires=Thu, 01 Jan 1970"),
    );
    expect(hasExpiredRedirectUrl).toEqual(true);

    const dcApiCookie = cookieValue(setCookies, process.env["API_TOKEN_NAME"]!);

    const apiToken = await ApiToken.create(dcApiCookie.value);

    expect(apiToken.token.sub).toEqual("uid123");
    expect(apiToken.token.name).toEqual("uid123");
    expect(apiToken.token.email).toEqual("uid123@e.northwestern.edu");
    expect(apiToken.token.primaryAffiliation).toEqual(undefined);
    expect(apiToken.isLoggedIn()).toEqual(true);
  });

  it("assembles a user object from the netID if directory search fails", async () => {
    server.use(
      http.get(
        "https://nusso-base.com/directory-search/res/netid/bas/uid123",
        () =>
          HttpResponse.json(
            {
              fault: {
                faultstring:
                  "Execution of ServiceCallout Call-WebSSO-API failed. Reason: ResponseCode 404 is treated as error",
                detail: { errorcode: "steps.servicecallout.ExecutionFailed" },
              },
            },
            { status: 500 },
          ),
      ),
    );

    const req = makeRequest("https://example.com");
    const result = await sendRequest(req);

    const setCookies = result.headers.getSetCookie();
    const hasExpiredRedirectUrl = setCookies.some(
      (c) =>
        c.startsWith("redirectUrl=") && c.includes("Expires=Thu, 01 Jan 1970"),
    );
    expect(hasExpiredRedirectUrl).toEqual(true);

    const dcApiCookie = cookieValue(setCookies, process.env["API_TOKEN_NAME"]!);

    const apiToken = await ApiToken.create(dcApiCookie.value);

    expect(apiToken.token.sub).toEqual("uid123");
    expect(apiToken.token.name).toEqual("uid123");
    expect(apiToken.token.email).toEqual("uid123@e.northwestern.edu");
    expect(apiToken.isLoggedIn()).toEqual(true);
  });

  describe("redirect", () => {
    beforeEach(() => {
      server.use(
        http.get(
          "https://nusso-base.com/directory-search/res/netid/bas/uid123",
          () =>
            HttpResponse.json({
              results: [
                {
                  displayName: ["Some User"],
                  mail: "some.user@example.com",
                  eduPersonPrimaryAffiliation: "staff",
                },
              ],
            }),
        ),
      );
    });

    it("redirects to the redirectUrl if provided", async () => {
      const redirectUrl = "https://example.com/redirect";
      const req = makeRequest(redirectUrl);
      const result = await sendRequest(req);
      expect(result.status).toEqual(302);
      expect(result.headers.get("location")).toEqual(redirectUrl);
    });

    it("redirects to the default path if no redirectUrl is provided", async () => {
      const req = makeRequest();
      const result = await sendRequest(req);
      expect(result.status).toEqual(302);
      expect(result.headers.get("location")).toEqual(
        "https://thisisafakeapiurl/auth/whoami",
      );
    });
  });
});
