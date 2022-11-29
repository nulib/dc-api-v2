"use strict";

const { handler } = require("../../redirect");

const chai = require("chai");
const expect = chai.expect;

describe("redirect", function () {
  helpers.saveEnvironment();

  it("redirects unrecognized routes to the configured path", async () => {
    process.env.REDIRECT_TO = "/redirect/target";
    const event = helpers.mockEvent("GET", "/").render();
    const result = await handler(event);
    expect(result.statusCode).to.eq(302);
    expect(result.headers.location).to.eq("/redirect/target");
  });
});
