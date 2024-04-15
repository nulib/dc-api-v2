const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const { videoTranscodeSettings } = require("./transcode-templates");

const opensearchResponse = require("../api/response/opensearch");
const path = require("path");

/**
 * Handler for download file set endpoint (currently only handles VIDEO)
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email;
  if (!email) {
    return invalidRequest(400, "Query string must include email address");
  }

  if (!event.userToken.isSuperUser()) {
    return invalidRequest(401, "Unauthorized");
  }
  const esResponse = await getFileSet(id, {
    allowPrivate: true,
    allowUnpublished: true,
  });

  if (esResponse.statusCode == "200") {
    const doc = JSON.parse(esResponse.body);
    if (downloadAvailable(doc)) {
      return await processDownload(doc, email);
    } else {
      return invalidRequest(
        405,
        "Download only allowed for role: Access, work_type: Video, with a valid streaming_url"
      );
    }
  } else {
    return await opensearchResponse.transform(esResponse);
  }
});

function downloadAvailable(doc) {
  // Note - audio is not currently implemented due to an issue with AWS
  // & MediaConvert and our .m3u8 files
  return (
    doc.found &&
    doc._source.role === "Access" &&
    doc._source.mime_type != null &&
    ["video"].includes(doc._source.mime_type.split("/")[0]) &&
    doc._source.streaming_url != null
  );
}

async function processDownload(doc, email) {
  const stepFunctionConfig = process.env.STEP_FUNCTION_ENDPOINT
    ? { endpoint: process.env.STEP_FUNCTION_ENDPOINT }
    : {};
  const client = new SFNClient(stepFunctionConfig);

  const fileSet = doc._source;
  const url = new URL(fileSet.streaming_url);

  const sourceLocation = s3Location(fileSet.streaming_url);
  const destinationBucket = process.env.MEDIA_CONVERT_DESTINATION_BUCKET;
  const fileSetId = path.parse(url.pathname).name;
  const fileSetLabel = fileSet.label;
  const workId = fileSet.work_id;
  const fileType = fileSet.mime_type.split("/")[0];
  const destinationKey = `av-downloads/${fileSetId}.mp4`; //TODO - account for audio
  const destinationLocation = `s3://${destinationBucket}/av-downloads/${fileSetId}`; // TODO - account for audio
  const settings = videoTranscodeSettings(sourceLocation, destinationLocation); // TODO - account for audio

  var params = {
    stateMachineArn: process.env.AV_DOWNLOAD_STATE_MACHINE_ARN,
    input: JSON.stringify({
      configuration: {
        startTranscodeFunction: process.env.START_TRANSCODE_FUNCTION,
        transcodeStatusFunction: process.env.TRANSCODE_STATUS_FUNCTION,
        getDownloadLinkFunction: process.env.GET_DOWNLOAD_LINK_FUNCTION,
        sendTemplatedEmailFunction: process.env.SEND_TEMPLATED_EMAIL_FUNCTION,
      },
      transcodeInput: {
        settings: settings,
      },
      presignedUrlInput: {
        bucket: destinationBucket,
        key: destinationKey,
        disposition: `${fileSetId}.mp4`,
      },
      sendEmailInput: {
        to: email,
        template: process.env.AV_DOWNLOAD_EMAIL_TEMPLATE,
        from: process.env.REPOSITORY_EMAIL,
        params: {
          downloadLink: "",
          fileSetId,
          fileSetLabel,
          workId,
          fileType,
        },
      },
    }),
  };

  try {
    const command = new StartExecutionCommand(params);
    await client.send(command);

    return {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({
        message: `Creating download for file set (id: ${fileSet.id}). Check your email for a link.`,
      }),
    };
  } catch (err) {
    console.error("startExecution error", err);
    throw err;
  }
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
