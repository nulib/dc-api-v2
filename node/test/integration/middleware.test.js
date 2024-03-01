"use strict";

const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-http"));
const sinon = require("sinon");
const { wrap, __Honeybadger } = requireSource("handlers/middleware.js");

describe("middleware", () => {
  helpers.saveEnvironment();

  beforeEach(function () {
    __Honeybadger.configure({ enableUncaught: true });
  });

  afterEach(function () {
    __Honeybadger.configure({ enableUncaught: false });
    sinon.restore();
  });

  it("reports uncaught errors to Honeybadger", async () => {
    const event = helpers.mockEvent("GET", "/error").render();

    let fakeNotify = sinon.fake((error) => {
      expect(error.message).to.eq("Catch this!");
    });

    sinon.replace(__Honeybadger, "notifyAsync", fakeNotify);

    const handler = wrap(async (_event) => {
      throw new Error("Catch this!");
    });

    const result = await handler(event);
    expect(result.statusCode).to.eq(400);
    sinon.assert.calledOnce(fakeNotify);
  });
});
