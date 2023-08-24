const AWS = require("aws-sdk");
const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const opensearchResponse = require("../api/response/opensearch");

/**
 * A simple function to get a FileSet by id
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email
  if(!email){
    return invalidRequest(400, "Query string must include email address")
  }
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  console.log(esResponse);

  if (esResponse.statusCode == "200") {
    const doc = JSON.parse(esResponse.body)
    if (downloadAvailable(doc)) {
      return processDownload(doc._source.streaming_url, email);
    } else {
      return invalidRequest(405, "Download only allowed for role: Access, work_type: Video or Audio, with a valid streaming_url")
    }
  } else {
    return await opensearchResponse.transform(esResponse);
  }
});

function downloadAvailable(doc) {
  console.log("doc.found", doc.found)
  console.log("doc._source.role", doc._source.role)
  console.log("doc._source.streaming_url", doc._source.streaming_url)
  return (
    doc.found &&
    doc._source.role === "Access" &&
    doc._source.streaming_url != null
  );
}

function processDownload(streaming_url, email) {
  console.log("PROCESS DOWNLOAD")
  var stepfunctions = new AWS.StepFunctions({endpoint: 'http://172.17.0.1:8083'});

  var params = {
    stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:hlsStitcherStepFunction', 
    input: JSON.stringify({s3Location:s3Location(streaming_url), email: email })
  };
  stepfunctions.startExecution(params, function(err, data) {
    if (err) {
      console.log(err, err.stack); 
      
    }else {
      console.log(data);           
      
    } 
  })  
  return {
    statusCode: 200,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({
      message: `Creating download for ${streaming_url}. Check your email for a link.`,
    }),
  }; 
}

function s3Location(_streaming_url){
  // for now
  return "s3://meadow-s-streaming/88/c1/59/6b/-8/02/2-/45/a3/-9/a4/e-/22/76/c3/f1/46/59/88c1596b-8022-45a3-9a4e-2276c3f14659.m3u8"
}

function invalidRequest(code, message) {
  return {
    statusCode: code,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ message: message }),
  };
};
