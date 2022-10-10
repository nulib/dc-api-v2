const cookie = require("cookie");
const jwt = require("jsonwebtoken");

/**
 * NUSSO whoami - validates JWT and returns user info
 */
exports.handler = async (event) => {
  try {
    const token = cookie.parse(event.headers.Cookie)?.dcApiV2Token;
    const user = jwt.verify(token, process.env.API_TOKEN_SECRET);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": event.headers.Origin,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(user),
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: "Error verifying API token: " + error.message,
    };
  }
};
