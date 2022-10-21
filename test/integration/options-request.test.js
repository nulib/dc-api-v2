"use strict";

const chai = require("chai");
const expect = chai.expect;
const optionsHandler = require("../../src/handlers/options-request");

describe("OPTIONS handler", async () => {
  const event = helpers
    .mockEvent("OPTIONS", "/auth/whoami")
    .headers({
      Origin: "https://dc.library.northwestern.edu/origin-test-path",
    })
    .render();

  it("sends the correct CORS headers", async () => {
    const response = await optionsHandler.handler(event);
    expect(response.headers).to.contain({
      "Access-Control-Allow-Origin":
        "https://dc.library.northwestern.edu/origin-test-path",
    });
  });
});
