const { processRequest, processResponse } = require("./middleware");

/**
 * Whoami - validates JWT and returns user info, or issues an anonymous
 * token if none is present
 */
exports.handler = async (event) => {
  event = processRequest(event);

  try {
    const token = event.userToken;

    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": event.headers.origin,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(token.userInfo()),
    };

    return processResponse(event, response);
  } catch (error) {
    return {
      statusCode: 401,
      body: "Error verifying API token: " + error.message,
    };
  }
};
