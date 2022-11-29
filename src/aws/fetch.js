const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { SignatureV4 } = require("@aws-sdk/signature-v4");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const { Sha256 } = require("@aws-crypto/sha256-browser");
const region = require("./environment").region();

async function awsFetch(request) {
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: region,
    service: "es",
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  const client = new NodeHttpHandler();
  const { response } = await client.handle(signedRequest);

  return await new Promise((resolve, _reject) => {
    let returnValue = {
      statusCode: response.statusCode,
    };
    let responseBody = "";

    response.body.on("data", function (chunk) {
      responseBody += chunk;
    });
    response.body.on("end", function (chunk) {
      resolve({ ...returnValue, body: responseBody });
    });
  });
}

module.exports = { awsFetch };
