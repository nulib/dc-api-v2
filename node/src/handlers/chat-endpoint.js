const { wrap } = require("./middleware");
const Honeybadger = require("../honeybadger-setup");

/**
 * ChatEndpoint - Returns the function URL of the streaming chat handler
 */
exports.handler = wrap(async (event) => {
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({
        url: process.env.CHAT_ENDPOINT,
        auth: event.userToken.sign(),
      }),
    };
  } catch (error) {
    await Honeybadger.notifyAsync(error);
    return {
      statusCode: 401,
      body: "Error: " + error.message,
    };
  }
});
