const axios = require("axios").default;
const { wrap } = require("./middleware");
const ApiToken = require("../api/api-token");
const Honeybadger = require("../honeybadger-setup");

/**
 * Performs NUSSO logout
 */
exports.handler = wrap(async (event) => {
  const url = `${process.env.NUSSO_BASE_URL}logout`;

  try {
    const response = await axios.get(url, {
      headers: { apikey: process.env.NUSSO_API_KEY },
    });
    event.userToken = new ApiToken().expire();
    return {
      statusCode: 302,
      headers: {
        location: response.data.url,
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
