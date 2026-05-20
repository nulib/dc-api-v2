import { describe, it, expect } from "bun:test";
import { transformError } from "../../../../src/api/response/error.ts";
import { testFixture } from "../../../test-helpers/index.ts";

describe("The error response", () => {
  it("Transforms a missing work response", async () => {
    const response = {
      status: 404,
      body: testFixture("mocks/missing-work-1234.json"),
    };
    const result = transformError(response);

    expect(result.status).toEqual(404);
    const body = await result.json();
    expect(body.status).toEqual(404);
    expect(body.error).toEqual("Not Found");
  });
});
