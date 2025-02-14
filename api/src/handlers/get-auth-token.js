const { wrap } = require("./middleware");
const Honeybadger = require("../honeybadger-setup");

const DEFAULT_TTL = 86400; // one day
const MAX_TTL = DEFAULT_TTL * 7; // one week;

const makeError = (code, message) => {
  return {
    statusCode: code,
    headers: {
      "Content-Type": "text/plain",
    },
    body: message,
  };
};

const present = (value) =>
  value !== undefined && value !== null && value !== "";

/**
 * Token - Returns auth token for current user with requested expiration
 *
 */
exports.handler = wrap(async (event) => {
  try {
    const ttl = event.queryStringParameters?.ttl;
    if (present(ttl) && ttl.match(/\D/)) {
      return makeError(400, `'${ttl}' is not a valid value for ttl`);
    }
    const ttl_in_seconds = Number(ttl) || DEFAULT_TTL;
    if (ttl_in_seconds > MAX_TTL) {
      return makeError(400, `ttl cannot exceed ${MAX_TTL} seconds`);
    }

    const token = event.userToken;
    const expiration = new Date(new Date().getTime() + ttl_in_seconds * 1000);
    expiration.setMilliseconds(0);
    token.expireAt(expiration);

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: token.sign(),
        expires: expiration.toISOString(),
      }),
    };
  } catch (error) {
    await Honeybadger.notifyAsync(error);
    return makeError(401, "Error verifying API token: " + error.message);
  }
});
