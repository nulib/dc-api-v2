const axios = require("axios").default;
const cookie = require("cookie");
const { processRequest, processResponse } = require("./middleware");
const ApiToken = require("../api/api-token");

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
        headers: {
          location: response.data.url,
        },
      };
      event.userToken = new ApiToken().expire();
    })
    .catch((error) => {
      console.error("NUSSO request error", error);
      resp = {
        statusCode: 401,
      };
    });

  return processResponse(event, resp);
};
