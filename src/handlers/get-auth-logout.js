const axios = require("axios").default;
const cookie = require("cookie");
const { processRequest, processResponse } = require("./middleware");
const { apiTokenName } = require("../aws/environment");

/**
 * Performs NUSSO logout
 */
exports.handler = async (event) => {
  event = processRequest(event);
  const url = `${process.env.NUSSO_BASE_URL}logout`;
  let resp;

  await axios
    .get(url, { headers: { apikey: process.env.NUSSO_API_KEY } })
    .then((response) => {
      resp = {
        statusCode: 302,
        cookies: [
          cookie.serialize(apiTokenName(), null, {
            expires: new Date(1),
            domain: "library.northwestern.edu",
            path: "/",
            secure: true,
          }),
        ],
        headers: {
          location: response.data.url,
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
