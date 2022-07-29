const AWS = require("aws-sdk");
const index = process.env.INDEX;
const elasticsearchEndpoint = process.env.ELASTICSEARCH_ENDPOINT;
const region = "us-east-1";

async function makeRequest(id) {
  return new Promise((resolve, _reject) => {
    const endpoint = new AWS.Endpoint(elasticsearchEndpoint);
    const request = new AWS.HttpRequest(endpoint, region);

    request.method = "GET";
    request.path += index + `/_doc/${id}`;
    request.headers["host"] = elasticsearchEndpoint;
    request.headers["Content-Type"] = "application/json";

    let chain = new AWS.CredentialProviderChain();
    chain.resolve((err, credentials) => {
      if (err) {
        console.error("Returning unsigned request: ", err);
      } else {
        var signer = new AWS.Signers.V4(request, "es");
        signer.addAuthorization(credentials, new Date());
      }
      resolve(request);
    });
  });
}

async function awsFetch(request) {
  console.log(`request`, request);

  return new Promise((resolve, reject) => {
    var client = new AWS.HttpClient();
    client.handleRequest(
      request,
      null,
      function (response) {
        let responseBody = "";
        response.on("data", function (chunk) {
          responseBody += chunk;
        });
        response.on("end", function (chunk) {
          resolve(responseBody);
        });
      },
      function (error) {
        console.error("Error: " + error);
      }
    );
  });
}

/**
 * A simple function to get a work by id
 */
exports.getWorkByIdHandler = async (event) => {
  if (event.httpMethod !== "GET") {
    throw new Error(
      `getMethod only accept GET method, you tried: ${event.httpMethod}`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received event:", event);

  // Get work id from pathParameters from APIGateway because of `/works/{id}` at template.yaml
  const id = event.pathParameters.id;

  console.log("id", id);

  let request = await makeRequest(id);
  let esResponse = await awsFetch(request);

  const response = {
    statusCode: 200,
    body: esResponse,
  };

  console.info(
    `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
  );
  return response;
};
