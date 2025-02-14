const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require("@aws-sdk/client-secrets-manager");
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

let Secrets;

const getSecret = (key) => {
  return process.env[key.toUpperCase()] || Secrets[key];
};

/**
 * Handler for download file set endpoint
 */
exports.handler = wrap(async (event, context) => {
  const secretsManagerClient =
    context?.injections?.secretsManagerClient || new SecretsManagerClient({});
  await loadSecrets(secretsManagerClient);

  const id = event.pathParameters.id;
  const email = event.queryStringParameters?.email;
  const referer = event.headers?.referer;

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
    if (isAVDownload(doc)) {
      if (!email) {
        return invalidRequest(400, "Query string must include email address");
      }
      if (!event.userToken.isSuperUser()) {
        return invalidRequest(401, "Unauthorized");
      }
      return await processAVDownload(doc, email, referer);
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

async function loadSecrets(client) {
  if (Secrets) return Secrets;

  const SECRETS_PATH =
    process.env?.API_CONFIG_PREFIX || process.env.SECRETS_PATH;
  const SecretId = `${SECRETS_PATH}/config/av-download`;
  try {
    const cmd = new GetSecretValueCommand({ SecretId });
    const secretsResponse = await client.send(cmd);
    if (secretsResponse.SecretString) {
      Secrets = JSON.parse(secretsResponse.SecretString);
    }
  } catch (err) {
    console.warn("Error loading secrets from", SecretId);
  }
  return Secrets;
}

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

function isAVDownload(doc) {
  return (
    doc.found &&
    doc._source.role === "Access" &&
    doc._source.mime_type != null &&
    ["audio", "video"].includes(doc._source.mime_type.split("/")[0]) &&
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

function isAudio(doc) {
  return ["audio"].includes(doc._source.mime_type.split("/")[0]);
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
  const bucket = getSecret("pyramid_bucket");
  const key = derivativeKey(doc);

  const getObjectParams = {
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename=${
      doc._source.accession_number
    }.${mime.extension(doc._source.mime_type)}`,
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
  const dimensions = "/full/!3000,3000/0/default.jpg";
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

async function processAVDownload(doc, email, referer) {
  const stepFunctionConfig = getSecret("step_function_endpoint")
    ? { endpoint: getSecret("step_function_endpoint") }
    : {};
  const client = new SFNClient(stepFunctionConfig);

  const fileSet = doc._source;
  const url = new URL(fileSet.streaming_url);

  const sourceLocation = s3Location(fileSet.streaming_url);
  const destinationBucket = getSecret("media_convert_destination_bucket");
  const fileSetId = path.parse(url.pathname).name;
  const fileSetLabel = fileSet.label;
  const workId = fileSet.work_id;
  const fileType = fileSet.mime_type.split("/")[0];
  const destinationKey = isAudio(doc)
    ? `av-downloads/${fileSetId}.mp3`
    : `av-downloads/${fileSetId}.mp4`;
  const destinationLocation = `s3://${destinationBucket}/av-downloads/${fileSetId}`;
  const settings = isAudio(doc)
    ? {}
    : videoTranscodeSettings(sourceLocation, destinationLocation);
  const filename = isAudio(doc) ? `${fileSetId}.mp3` : `${fileSetId}.mp4`;

  var params = {
    stateMachineArn: getSecret("av_download_state_machine_arn"),
    input: JSON.stringify({
      configuration: {
        startAudioTranscodeFunction: getSecret(
          "start_audio_transcode_function"
        ),
        startTranscodeFunction: getSecret("start_transcode_function"),
        transcodeStatusFunction: getSecret("transcode_status_function"),
        getDownloadLinkFunction: getSecret("get_download_link_function"),
        sendTemplatedEmailFunction: getSecret("send_templated_email_function"),
      },
      transcodeInput: {
        settings: settings,
        type: fileType,
        streamingUrl: fileSet.streaming_url,
        referer: referer,
        destinationBucket: destinationBucket,
        destinationKey: destinationKey,
      },
      presignedUrlInput: {
        bucket: destinationBucket,
        key: destinationKey,
        disposition: filename,
      },
      sendEmailInput: {
        to: email,
        template: getSecret("av_download_email_template"),
        from: getSecret("repository_email"),
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
  return `s3://${getSecret("streaming_bucket")}${url.pathname}`;
}

function invalidRequest(code, message) {
  return {
    statusCode: code,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ message: message }),
  };
}
