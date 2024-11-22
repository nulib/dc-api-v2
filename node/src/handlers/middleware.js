const {
  BatchGetSecretValueCommand,
  SecretsManagerClient,
} = require("@aws-sdk/client-secrets-manager");
const {
  addCorsHeaders,
  addEtag,
  decodeEventBody,
  decodeToken,
  encodeToken,
  ensureCharacterEncoding,
  maybeUseProxiedIp,
  normalizeHeaders,
  objectifyCookies,
  stubEventMembers,
} = require("../helpers");

const debug = require("debug")("api.middleware");
const Honeybadger = require("../honeybadger-setup");
const { StatusCodes } = require("http-status-codes");
const { SECRETS_PATH } = process.env;
const SecretPaths = [
  `${SECRETS_PATH}/infrastructure/index`,
  `${SECRETS_PATH}/infrastructure/nusso`,
];

const wrap = function (handler) {
  return async (event, context) => {
    await _initializeEnvironment();

    let response;
    try {
      event = __processRequest(event);
      response = await handler(event, context);
    } catch (error) {
      if (Honeybadger.config.enableUncaught) {
        await Honeybadger.notifyAsync(error);
      }
      response = _convertErrorToResponse(error);
    }
    return __processResponse(event, response);
  };
};

const _initializeEnvironment = async function () {
  if (process.env.__SKIP_SECRETS__) return;

  const putenv = (name, value) => {
    if (!process.env[name]) process.env[name] = value;
  };

  const client = new SecretsManagerClient();
  const cmd = new BatchGetSecretValueCommand({
    SecretIdList: Object.values(SecretPaths),
  });
  const { SecretValues } = await client.send(cmd);
  const secrets = {};
  for (const { Name, SecretString } of SecretValues) {
    secrets[Name.split("/").reverse()[0]] = JSON.parse(SecretString);
  }

  let { endpoint } = secrets.index;
  if (URL.canParse(endpoint)) {
    endpoint = new URL(endpoint).hostname;
  }

  putenv("OPENSEARCH_ENDPOINT", endpoint);
  putenv("OPENSEARCH_MODEL_ID", secrets.index?.embedding_model);
  putenv("NUSSO_API_KEY", secrets.nusso?.api_key);
  putenv("NUSSO_BASE_URL", secrets.nusso?.base_url);
  putenv("__SKIP_SECRETS__", "true");
};

const _convertErrorToResponse = function (error) {
  if (error.response && error.response.status) {
    return {
      statusCode: error.response.status,
      headers: error.response.headers,
      body: error.response.body,
    };
  } else {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      headers: { "content-type": "text/plain" },
      body: error.message,
    };
  }
};

const __processRequest = function (event) {
  if (event.__processRequest) return event;
  let result = maybeUseProxiedIp(event);
  result = stubEventMembers(event);
  result = normalizeHeaders(event);
  result = objectifyCookies(result);
  result = decodeEventBody(result);
  result = decodeToken(result);
  result.__processRequest = true;

  Honeybadger.setContext({ event: result });
  debug(result);
  return result;
};

const __processResponse = function (event, response) {
  let result = addCorsHeaders(event, response);
  result = addEtag(event, result);
  result = encodeToken(event, result);
  result = ensureCharacterEncoding(result, "UTF-8");
  debug(result);
  return result;
};

module.exports = {
  wrap,
  __processRequest,
  __processResponse,
  __Honeybadger: Honeybadger,
};
