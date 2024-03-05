const { dcApiEndpoint } = require("../environment");
const axios = require("axios").default;
const cookie = require("cookie");
const { wrap } = require("./middleware");
const Honeybadger = require("../honeybadger-setup");
const url = require("url");

/**
 * Performs NUSSO login
 */
exports.handler = wrap(async (event) => {
  const callbackUrl = `${dcApiEndpoint()}/auth/callback`;
  const nussoUrl = `${process.env.NUSSO_BASE_URL}get-ldap-redirect-url`;
  let returnPath = event.queryStringParameters?.goto || event.headers?.referer;

  if (!returnPath) {
    return {
      statusCode: 400,
    };
  }

  const parsedUrl = url.parse(returnPath, true);
  const mergedQueryParams = { ...event.queryStringParameters };
  delete mergedQueryParams.goto;
  parsedUrl.search = null;
  parsedUrl.query = { ...parsedUrl.query, ...mergedQueryParams };
  returnPath = url.format(parsedUrl);

  try {
    const response = await axios.get(nussoUrl, {
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
          Buffer.from(returnPath, "utf8").toString("base64").replace(/=/g, "")
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
