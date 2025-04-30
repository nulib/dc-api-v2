const axios = require("axios").default;
const { dcUrl } = require("../environment");
const { wrap } = require("./middleware");
const ApiToken = require("../api/api-token");
const Honeybadger = require("../honeybadger-setup");

/**
 * Performs NUSSO logout
 */
exports.handler = wrap(async (event) => {
  try {
    let responseLocation =
      event.queryStringParameters?.goto || event.headers?.referer || dcUrl();

    if (event.userToken && event.userToken.token.provider === "nusso") {
      const url = `${process.env.NUSSO_BASE_URL}logout`;
      const response = await axios.get(url, {
        headers: { apikey: process.env.NUSSO_API_KEY },
      });
      responseLocation = response.data.url;
    }

    event.userToken = new ApiToken().expire();
    return {
      statusCode: 302,
      headers: {
        location: responseLocation,
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
