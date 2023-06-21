const { wrap } = require("./middleware");
const Honeybadger = require("../honeybadger-setup");

/**
 * Whoami - validates JWT and returns user info, or issues an anonymous
 * token if none is present
 */
exports.handler = wrap(async (event) => {
  try {
    const token = event.userToken;

    return {
      statusCode: 200,
      body: JSON.stringify(token.userInfo()),
    };
  } catch (error) {
    await Honeybadger.notifyAsync(error);
    return {
      statusCode: 401,
      body: "Error verifying API token: " + error.message,
    };
  }
});
