"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));
const sinon = require("sinon");
const { wrap, __Honeybadger } = requireSource("handlers/middleware.js");

describe("middleware", () => {
  helpers.saveEnvironment();

  afterEach(function () {
    sinon.restore();
  });

  it("reports uncaught errors to Honeybadger", async () => {
    const event = helpers.mockEvent("GET", "/error").render();

    sinon.replace(
      __Honeybadger,
      "notifyAsync",
      sinon.fake((error) => {
        expect(error.message).to.eq("Catch this!");
      })
    );

    const handler = wrap(async (_event) => {
      throw new Error("Catch this!");
    });

    const result = await handler(event);
    expect(result.statusCode).to.eq(400);
  });
});
