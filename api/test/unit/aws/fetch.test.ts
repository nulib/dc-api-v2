import { describe, it, beforeEach, afterEach, expect, spyOn } from "bun:test";
import { HttpRequest } from "@smithy/protocol-http";
import { awsFetch, requestUrl } from "../../../src/aws/fetch.ts";
import { setupEnv, teardownEnv } from "../../test-helpers/index.ts";

describe("requestUrl()", () => {
  it("includes Smithy request query parameters", () => {
    const request = new HttpRequest({
      method: "POST",
      hostname: "index.test.library.northwestern.edu",
      path: "/dc-v2-work/_search",
      query: {
        bare: null,
        repeated: ["one", "two"],
        search_pipeline: "dc-v2-work-pipeline",
        space: "has spaces",
      },
    });

    expect(requestUrl(request)).toEqual(
      "https://index.test.library.northwestern.edu/dc-v2-work/_search?bare&repeated=one&repeated=two&search_pipeline=dc-v2-work-pipeline&space=has%20spaces",
    );
  });
});

describe("awsFetch()", () => {
  beforeEach(() => setupEnv());
  afterEach(() => teardownEnv());

  it("sends signed query parameters in the fetch URL", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    try {
      const result = await awsFetch(
        new HttpRequest({
          method: "POST",
          hostname: "index.test.library.northwestern.edu",
          headers: {
            Host: "index.test.library.northwestern.edu",
            "Content-Type": "application/json",
          },
          body: "{}",
          path: "/dc-v2-work/_search",
          query: { search_pipeline: "dc-v2-work-pipeline" },
        }),
      );

      expect(result.status).toEqual(200);
      const calledUrl = fetchSpy.mock.calls[0][0].toString();
      expect(calledUrl).toContain("?search_pipeline=dc-v2-work-pipeline");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
