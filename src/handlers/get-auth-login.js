const { dcApiEndpoint, apiTokenSecret } = require("../environment");
const axios = require("axios").default;
const cookie = require("cookie");
const { processRequest, processResponse } = require("./middleware");

/**
 * Performs NUSSO login
 */
exports.handler = async (event) => {
  event = processRequest(event);

  const callbackUrl = `${dcApiEndpoint()}/auth/callback`;
  const url = `${process.env.NUSSO_BASE_URL}get-ldap-redirect-url`;
  const returnPath =
    event.queryStringParameters?.goto || event.headers?.referer;

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
    })
    .catch((error) => {
      console.error("NUSSO request error", error);
      resp = {
        statusCode: 401,
      };
    });

  return processResponse(event, resp);
};
