const { wrap } = require("./middleware");

const handler = wrap(async (event) => {
  if (!event.userToken.can("chat")) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "text/plain" },
      body: "Authorization Required",
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      endpoint: process.env.WEBSOCKET_URI,
      auth: event.userToken.sign(),
    }),
  };
});

module.exports = { handler };
