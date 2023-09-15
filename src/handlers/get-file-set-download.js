const AWS = require("aws-sdk");
const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const { transcodeSettings } = require("./transcode-templates");

const opensearchResponse = require("../api/response/opensearch");
const path = require("path");

/**
 * Handler for download file set endpoint
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email;
  if (!email) {
    return invalidRequest(400, "Query string must include email address");
  }
  const allowPrivate =
    event.userToken.isSuperUser() || event.userToken.isReadingRoom();
  const allowUnpublished = event.userToken.isSuperUser();
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });
  console.log(esResponse);

  if (esResponse.statusCode == "200") {
    const doc = JSON.parse(esResponse.body);
    if (downloadAvailable(doc)) {
      return processDownload(doc._source.streaming_url, email);
    } else {
      return invalidRequest(
        405,
        "Download only allowed for role: Access, work_type: Video or Audio, with a valid streaming_url"
      );
    }
  } else {
    return await opensearchResponse.transform(esResponse);
  }
});

function downloadAvailable(doc) {
  console.log("doc.found", doc.found);
  console.log("doc._source.role", doc._source.role);
  console.log("doc._source.streaming_url", doc._source.streaming_url);
  return (
    doc.found &&
    doc._source.role === "Access" &&
    doc._source.streaming_url != null
  );
}

function processDownload(streaming_url, email) {
  console.log("PROCESS DOWNLOAD");
  // move endpoint to var? or ??
  var stepfunctions = new AWS.StepFunctions({
    endpoint: "http://172.17.0.1:8083",
  });
  const url = new URL(streaming_url);

  // does the role at least belong in the Media convert lambda

  const sourceLocation = s3Location(streaming_url); // camelCase streaming url?
  const destinationBucket = process.env.MEDIA_CONVERT_DESTINATION_BUCKET;
  const fileSetId = path.parse(url.pathname).name
  const destinationKey = `downloads/${fileSetId}.mp4`;
  const destinationLocation = `s3://${destinationBucket}/downloads/${fileSetId}`;
  const settings = transcodeSettings(sourceLocation, destinationLocation);

  // console.log("url", url);
  // console.log("streaming_url", streaming_url);
  // console.log("sourceLocation", sourceLocation);
  // console.log("destinationBucket", destinationBucket);
  // console.log("destinationKey", destinationKey);
  // console.log("destinationLocation", destinationLocation);

  // move the state machine arn to variable
  var params = {
    stateMachineArn:
      "arn:aws:states:us-east-1:123456789012:stateMachine:hlsStitcherStepFunction",
    input: JSON.stringify({
      transcodeInput: {
        //source:s3Location(streaming_url)
        settings: settings,
      },
      presignedUrlInput: {
        bucket: destinationBucket,
        key: destinationKey,
      },
      sendMailInput: {
        to: email,
      },
    }),
  };

  console.log(params);

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

function s3Location(streaming_url) {
  const url = new URL(streaming_url);
  return `s3://${process.env.STREAMING_BUCKET}${url.pathname}`;
}

function invalidRequest(code, message) {
  return {
    statusCode: code,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ message: message }),
  };
}
