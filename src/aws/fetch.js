const AWS = require("aws-sdk");

function awsFetch(request) {
  console.log(`request`, request);

  return new Promise((resolve, reject) => {
    signRequest(request)
      .then((signedRequest) => {
        var client = new AWS.HttpClient();
        client.handleRequest(
          signedRequest,
          null,
          function (response) {
            let returnValue = {
              statusCode: response.statusCode
            }
            let responseBody = "";
            response.on("data", function (chunk) {
              responseBody += chunk;
            });
            response.on("end", function (chunk) {
              resolve({ ...returnValue, body: responseBody });
            });
          },
          function (error) {
            console.error("Error: " + error);
            reject(error);
          }
        );
      })
  });
}

function signRequest(request) {
  return new Promise((resolve, _reject) => {
    let chain = new AWS.CredentialProviderChain();

    chain.resolve((err, credentials) => {
      if (err) {
        console.error("Sending unsigned request: ", err);
      } else {
        var signer = new AWS.Signers.V4(request, "es");
        signer.addAuthorization(credentials, new Date());
      }
      resolve(request);
    });

  })
}

module.exports = { awsFetch };