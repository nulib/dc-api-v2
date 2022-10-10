const jwt = require("jsonwebtoken");
const { processRequest, processResponse } = require("./middleware");

/**
 * NUSSO whoami - validates JWT and returns user info
 */
exports.handler = async (event) => {
  event = processRequest(event);

  try {
    const token = event.cookieObject.dcApiV2Token;
    const user = jwt.verify(token, process.env.API_TOKEN_SECRET);

    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": event.headers.origin,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(user),
    };
    return processResponse(event, response);
  } catch (error) {
    return {
      statusCode: 401,
      body: "Error verifying API token: " + error.message,
    };
  }
};
