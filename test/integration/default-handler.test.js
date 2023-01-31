"use strict";

const chai = require("chai");
const expect = chai.expect;

const defaultHandler = requireSource("handlers/default-request");

describe("$default handler", async () => {
  const event = helpers
    .mockEvent("GET", "/blah")
    .headers({
      Origin: "https://dc.library.northwestern.edu/origin-test-path",
    })
    .render();

  it("returns a 404 response", async () => {
    const response = await defaultHandler.handler(event);
    expect(response.statusCode).to.eq(404);
    expect(JSON.parse(response.body).status).to.eq(404);
    expect(JSON.parse(response.body).error).to.eq("Not Found");
  });
});
