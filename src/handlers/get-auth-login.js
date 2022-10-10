const { dcApiEndpoint } = require("../aws/environment");
const axios = require("axios").default;
const cookie = require("cookie");

/**
 * Performs NUSSO login
 */
exports.handler = async (event) => {
  const callbackUrl = `${dcApiEndpoint()}/auth/callback`;
  const url = `${process.env.NUSSO_BASE_URL}get-ldap-redirect-url`;
  const returnPath =
    event.queryStringParameters?.goto || event.headers?.Referer;

  if (!returnPath) {
    return {
      statusCode: 400,
    };
  }

  let resp;

  await axios
    .get(url, {
      headers: {
        apikey: process.env.NUSSO_API_KEY,
        goto: callbackUrl,
      },
    })
    .then((response) => {
      resp = {
        statusCode: 302,
        headers: {
          location: response.data.redirecturl,
          "set-cookie": cookie.serialize("redirectUrl", returnPath, {
            encode: function (token) {
              return Buffer.from(token, "utf8").toString("base64");
            },
          }),
        },
      };
    })
    .catch((error) => {
      console.error("NUSSO request error", error);
      resp = {
        statusCode: 401,
      };
    });

  return resp;
};
