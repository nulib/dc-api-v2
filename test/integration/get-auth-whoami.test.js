"use strict";

const chai = require("chai");
const expect = chai.expect;
const nock = require("nock");
const getAuthWhoamiHandler = require("../../src/handlers/get-auth-whoami");

describe("auth whoami", function () {
  helpers.saveEnvironment();

  it("redeems a valid NUSSO token", async () => {
    process.env.API_TOKEN_SECRET = "abc123";

    const event = helpers
      .mockEvent("GET", "/auth/whoami")
      .pathPrefix("/api/v2")
      .headers({
        Cookie:
          "dcApiV2Token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkaXNwbGF5TmFtZSI6IlNvbWUgT25lIiwiaWF0IjoxNjY1NDE3NzYzfQ.Nwi8dJnc7w201ZtO5de5zYmU-F5gEalkmHZ5pR1VXms;",
      })
      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    expect(result.statusCode).to.eq(200);
    expect(JSON.parse(result.body)).to.contain({ displayName: "Some One" });
  });

  it("rejects an invalid or missing NUSSO token", async () => {
    process.env.API_TOKEN_SECRET = "abc123";

    const event = helpers
      .mockEvent("GET", "/auth/whoami")
      .pathPrefix("/api/v2")
      .render();

    const result = await getAuthWhoamiHandler.handler(event);
    expect(result.statusCode).to.eq(401);
    expect(result.body).to.eq(
      "Error verifying API token: argument str must be a string"
    );
  });
});
