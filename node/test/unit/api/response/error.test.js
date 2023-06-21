const chai = require("chai");
const expect = chai.expect;

const errorTransformer = requireSource("api/response/error");

describe("The error response", () => {
  it("Transforms a missing work response", async () => {
    const response = {
      statusCode: 404,
      body: helpers.testFixture("mocks/missing-work-1234.json"),
    };
    const result = errorTransformer.transformError(response);

    expect(result.statusCode).to.eq(404);
    expect(JSON.parse(result.body).status).to.eq(404);
    expect(JSON.parse(result.body).error).to.eq("Not Found");
  });
});
