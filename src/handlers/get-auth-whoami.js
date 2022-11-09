const jwt = require("jsonwebtoken");
const { processRequest, processResponse } = require("./middleware");
const { apiTokenName } = require("../aws/environment");
const { dcApiToken } = require("./api-token");
const cookie = require("cookie");

/**
 * NUSSO whoami - validates JWT and returns user info
 */
exports.handler = async (event) => {
  event = processRequest(event);

  try {
    const token = event.cookieObject[apiTokenName()];
    console.log("TOKEN", token);

    if (token) {
      console.log("process.env.API_TOKEN_SECRET", process.env.API_TOKEN_SECRET);

      const user = jwt.verify(token, process.env.API_TOKEN_SECRET);
      console.log("USER", user);

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
    } else {
      const anonymousToken = dcApiToken({});

      response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": event.headers.origin,
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Credentials": "true",
        },
        cookies: [
          cookie.serialize(process.env.API_TOKEN_NAME, anonymousToken, {
            domain: "library.northwestern.edu",
            path: "/",
            secure: true,
          }),
        ],
        body: JSON.stringify(
          jwt.verify(anonymousToken, process.env.API_TOKEN_SECRET)
        ),
      };
      return processResponse(event, response);
    }
  } catch (error) {
    return {
      statusCode: 401,
      body: "Error verifying API token: " + error.message,
    };
  }
};
