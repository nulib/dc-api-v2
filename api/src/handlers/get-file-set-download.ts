import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { getFileSet } from "../api/opensearch.ts";
import { videoTranscodeSettings } from "./transcode-templates.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { apiTokenName } from "../environment.ts";
import ApiToken from "../api/api-token.ts";
import cookie from "cookie";
import mime from "mime-types";
import { transform as opensearchResponse } from "../api/response/opensearch/index.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import type { OpenSearchGetResponse } from "../api/opensearch-types.ts";
import type { FileSetSource } from "../api/response/iiif/types.ts";

let Secrets: Record<string, string> | undefined;

const getSecret = (key: string): string => {
  return process.env[key.toUpperCase()] || Secrets?.[key] || "";
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  await loadSecrets(new SecretsManagerClient({}));

  const params = new URL(req.url).searchParams;
  const id = c.req.param("id")!;
  const email = params.get("email") ?? undefined;
  const referer = c.req.header("referer") ?? undefined;

  const userToken = c.get("userToken");
  const allowPrivate =
    userToken.isSuperUser() ||
    userToken.isReadingRoom() ||
    userToken.hasEntitlement(id);
  const allowUnpublished =
    userToken.isSuperUser() || userToken.hasEntitlement(id);
  const esResponse = await getFileSet(id, { allowPrivate, allowUnpublished });

  if (String(esResponse.status) === "200") {
    const doc = JSON.parse(
      esResponse.body,
    ) as OpenSearchGetResponse<FileSetSource>;
    if (isAVDownload(doc)) {
      if (!email)
        return invalidRequest(400, "Query string must include email address");
      if (!userToken.isSuperUser()) return invalidRequest(401, "Unauthorized");
      return await processAVDownload(doc, email, referer);
    } else if (isImageDownload(doc)) {
      return await IIIFImageRequest(doc);
    } else if (isAltFileDownload(doc)) {
      const url = await getDownloadLink(doc);
      return new Response(null, { status: 302, headers: { Location: url } });
    } else {
      return invalidRequest(405, "Download not allowed for role + work_type");
    }
  } else {
    return await opensearchResponse(esResponse);
  }
};

async function loadSecrets(
  client: SecretsManagerClient,
): Promise<Record<string, string> | undefined> {
  if (Secrets) return Secrets;

  const SECRETS_PATH =
    process.env["API_CONFIG_PREFIX"] || process.env["SECRETS_PATH"];
  const SecretId = `${SECRETS_PATH}/config/av-download`;
  try {
    const cmd = new GetSecretValueCommand({ SecretId });
    const secretsResponse = await client.send(cmd);
    if (secretsResponse.SecretString) {
      Secrets = JSON.parse(secretsResponse.SecretString) as Record<
        string,
        string
      >;
    }
  } catch {
    console.warn("Error loading secrets from", SecretId);
  }
  return Secrets;
}

function isAltFileDownload(doc: OpenSearchGetResponse<FileSetSource>): boolean {
  const src = doc._source;
  const acceptedTypes = [
    "application/pdf",
    "application/zip",
    "application/zip-compressed",
  ];
  return (
    !!doc.found &&
    src?.role === "Auxiliary" &&
    src.mime_type != null &&
    acceptedTypes.includes(src.mime_type)
  );
}

function isAVDownload(doc: OpenSearchGetResponse<FileSetSource>): boolean {
  const src = doc._source;
  return (
    !!doc.found &&
    src?.role === "Access" &&
    src.mime_type != null &&
    ["audio", "video"].includes(src.mime_type.split("/")[0]) &&
    src.streaming_url != null
  );
}

function isImageDownload(doc: OpenSearchGetResponse<FileSetSource>): boolean {
  const src = doc._source;
  return (
    !!doc.found &&
    src != null &&
    ["Access", "Auxiliary"].includes(src.role) &&
    src.mime_type != null &&
    ["image"].includes(src.mime_type.split("/")[0])
  );
}

function isAudio(doc: OpenSearchGetResponse<FileSetSource>): boolean {
  const src = doc._source;
  return src != null && ["audio"].includes(src.mime_type.split("/")[0]);
}

function derivativeKey(doc: OpenSearchGetResponse<FileSetSource>): string {
  const id = doc._id!;
  const prefix =
    id.slice(0, 2) +
    "/" +
    id.slice(2, 4) +
    "/" +
    id.slice(4, 6) +
    "/" +
    id.slice(6, 8);
  return "derivatives/" + prefix + "/" + id;
}

async function getDownloadLink(
  doc: OpenSearchGetResponse<FileSetSource>,
): Promise<string> {
  const src = doc._source!;
  const bucket = getSecret("pyramid_bucket");
  const key = derivativeKey(doc);
  const ext = mime.extension(src.mime_type) || "bin";

  const getObjectParams = {
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename=${src.accession_number}.${ext}`,
  };

  const client = new S3Client({});
  const command = new GetObjectCommand(getObjectParams);
  return await getSignedUrl(client, command, { expiresIn: 3600 * 24 * 3 });
}

const IIIFImageRequest = async (
  doc: OpenSearchGetResponse<FileSetSource>,
): Promise<Response> => {
  const src = doc._source!;
  const dimensions = "/full/!3000,3000/0/default.jpg";
  const iiifImageBaseUrl = src.representative_image_url!;
  const url = `${iiifImageBaseUrl}${dimensions}`;
  const tokenValue = await new ApiToken().superUser().sign();
  const cookieHeader = cookie.serialize(apiTokenName(), tokenValue, {
    domain: "library.northwestern.edu",
    path: "/",
    secure: true,
  });

  const resp = await fetch(url, { headers: { cookie: cookieHeader } });
  const buf = await resp.arrayBuffer();

  if (resp.status !== 200) {
    return new Response(new TextDecoder().decode(buf), {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
    });
  }

  return new Response(btoa(String.fromCharCode(...new Uint8Array(buf))), {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "image/jpeg",
    },
  });
};

async function processAVDownload(
  doc: OpenSearchGetResponse<FileSetSource>,
  email: string,
  referer: string | undefined,
): Promise<Response> {
  const stepFunctionConfig = getSecret("step_function_endpoint")
    ? { endpoint: getSecret("step_function_endpoint") }
    : {};
  const client = new SFNClient(stepFunctionConfig);

  const fileSet = doc._source!;
  const url = new URL(fileSet.streaming_url!);

  const sourceLocation = s3Location(fileSet.streaming_url!);
  const destinationBucket = getSecret("media_convert_destination_bucket");
  const fileSetId =
    url.pathname
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? "";
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

  const params = {
    stateMachineArn: getSecret("av_download_state_machine_arn"),
    input: JSON.stringify({
      configuration: {
        startAudioTranscodeFunction: getSecret(
          "start_audio_transcode_function",
        ),
        startTranscodeFunction: getSecret("start_transcode_function"),
        transcodeStatusFunction: getSecret("transcode_status_function"),
        getDownloadLinkFunction: getSecret("get_download_link_function"),
        sendTemplatedEmailFunction: getSecret("send_templated_email_function"),
      },
      transcodeInput: {
        settings,
        type: fileType,
        streamingUrl: fileSet.streaming_url,
        referer,
        destinationBucket,
        destinationKey,
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
    return new Response(
      JSON.stringify({
        message: `Creating download for file set (id: ${fileSet.id}). Check your email for a link.`,
      }),
      {
        status: 200,
        headers: { "content-type": "text/plain" },
      },
    );
  } catch (err) {
    console.error("startExecution error", err);
    throw err;
  }
}

function s3Location(streaming_url: string): string {
  const url = new URL(streaming_url);
  return `s3://${getSecret("streaming_bucket")}${url.pathname}`;
}

function invalidRequest(code: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status: code,
    headers: { "content-type": "text/plain" },
  });
}
