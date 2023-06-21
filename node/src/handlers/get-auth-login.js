const { dcApiEndpoint } = require("../environment");
const axios = require("axios").default;
const cookie = require("cookie");
const { wrap } = require("./middleware");
const Honeybadger = require("../honeybadger-setup");

/**
 * Performs NUSSO login
 */
exports.handler = wrap(async (event) => {
  const callbackUrl = `${dcApiEndpoint()}/auth/callback`;
  const url = `${process.env.NUSSO_BASE_URL}get-ldap-redirect-url`;
  const returnPath =
    event.queryStringParameters?.goto || event.headers?.referer;

  if (!returnPath) {
    return {
      statusCode: 400,
    };
  }

  try {
    const response = await axios.get(url, {
      headers: {
        apikey: process.env.NUSSO_API_KEY,
        goto: callbackUrl,
      },
    });

    return {
      statusCode: 302,
      cookies: [
        cookie.serialize(
          "redirectUrl",
          Buffer.from(returnPath, "utf8").toString("base64")
        ),
      ],
      headers: {
        location: response.data.redirecturl,
      },
    };
  } catch (error) {
    await Honeybadger.notifyAsync(error, { tags: ["auth", "upstream"] });
    console.error("NUSSO request error", error);
    return {
      statusCode: 401,
    };
  }
});
