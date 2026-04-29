const { dcApiEndpoint, dcUrl } = require("../../../environment");
const { transformError } = require("../error");

async function transform(response) {
  if (response.statusCode === 200) {
    const responseBody = JSON.parse(response.body);
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: "IIIF canvas response not yet implemented",
    };
  }
  return transformError(response);
}

module.exports = { transform };