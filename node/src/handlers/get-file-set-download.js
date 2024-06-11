const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { wrap } = require("./middleware");
const { getFileSet } = require("../api/opensearch");
const { videoTranscodeSettings } = require("./transcode-templates");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { apiTokenName } = require("../environment");
const ApiToken = require("../api/api-token");
const axios = require("axios").default;
const cookie = require("cookie");
const mime = require("mime-types");
const opensearchResponse = require("../api/response/opensearch");
const path = require("path");

/**
 * Handler for download file set endpoint
 */
exports.handler = wrap(async (event) => {
  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email;

  const allowPrivate =
    event.userToken.isSuperUser() ||
    event.userToken.isReadingRoom() ||
    event.userToken.hasEntitlement(id);
  const allowUnpublished =
    event.userToken.isSuperUser() || event.userToken.hasEntitlement(id);
  const esResponse = await getFileSet(id, {
    allowPrivate,
    allowUnpublished,
  });

  if (esResponse.statusCode == "200") {
    const doc = JSON.parse(esResponse.body);
    if (isVideoDownload(doc)) {
      if (!email) {
        return invalidRequest(400, "Query string must include email address");
      }
      if (!event.userToken.isSuperUser()) {
        return invalidRequest(401, "Unauthorized");
      }
      return await processAVDownload(doc, email);
    } else if (isImageDownload(doc)) {
      return await IIIFImageRequest(doc);
    } else if (isAltFileDownload(doc)) {
      const url = await getDownloadLink(doc);
      return {
        statusCode: 302,
        headers: { Location: url },
      };
    } else {
      return invalidRequest(405, "Download not allowed for role + work_type");
    }
  } else {
    return await opensearchResponse.transform(esResponse);
  }
});

function isAltFileDownload(doc) {
  const acceptedTypes = [
    "application/pdf",
    "application/zip",
    "application/zip-compressed",
  ];
  return (
    doc.found &&
    doc._source.role === "Auxiliary" &&
    doc._source.mime_type != null &&
    acceptedTypes.includes(doc._source.mime_type)
  );
}

function isVideoDownload(doc) {
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

function isImageDownload(doc) {
  return (
    doc.found &&
    ["Access", "Auxiliary"].includes(doc._source.role) &&
    doc._source.mime_type != null &&
    ["image"].includes(doc._source.mime_type.split("/")[0])
  );
}

function derivativeKey(doc) {
  const id = doc._id;
  let prefix =
    id.slice(0, 2) +
    "/" +
    id.slice(2, 4) +
    "/" +
    id.slice(4, 6) +
    "/" +
    id.slice(6, 8);
  return "derivatives/" + prefix + "/" + id;
}

async function getDownloadLink(doc) {
  const clientParams = {};
  const bucket = process.env.PYRAMID_BUCKET;
  const key = derivativeKey(doc);

  const getObjectParams = {
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename=download.${mime.extension(
      doc._source.mime_type
    )}`,
  };

  const client = new S3Client(clientParams);
  const command = new GetObjectCommand(getObjectParams);
  const url = await getSignedUrl(client, command, { expiresIn: 3600 * 24 * 3 }); // 3 days
  return url;
}

const getAxiosResponse = (url, config) => {
  return new Promise((resolve) => {
    axios
      .get(url, config)
      .then((response) => resolve(response))
      .catch((error) => resolve(error.response));
  });
};

const IIIFImageRequest = async (doc) => {
  const dimensions = "/full/max/0/default.jpg";
  const iiifImageBaseUrl = doc._source.representative_image_url;
  const url = `${iiifImageBaseUrl}${dimensions}`;
  const { status, headers, data } = await getAxiosResponse(url, {
    headers: {
      cookie: cookie.serialize(
        apiTokenName(),
        new ApiToken().superUser().sign(),
        {
          domain: "library.northwestern.edu",
          path: "/",
          secure: true,
        }
      ),
    },
    responseType: "arraybuffer",
  });

  if (status != 200) {
    return {
      statusCode: status,
      body: data.toString(),
      headers: headers,
    };
  }

  return {
    statusCode: status,
    isBase64Encoded: true,
    body: data.toString("base64"),
    headers: {
      "content-type": headers["content-type"],
    },
  };
};

async function processAVDownload(doc, email) {
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
