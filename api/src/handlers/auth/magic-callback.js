const { verifyMagicToken } = require("./magic-link");
const ApiToken = require("../../api/api-token");

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing token" }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
  try {
    const { email, returnUrl } = verifyMagicToken(decodeURIComponent(token));
    const user = {
      sub: email,
      name: email,
    };
    console.info("User", user.sub, "logged in via magic link");
    event.userToken = new ApiToken().user(user).provider("magic");
    return {
      statusCode: 302,
      headers: {
        location: returnUrl,
      },
    };
  } catch (error) {
    const errorMessage = error.message;
    let statusCode = 500;
    switch (error.code) {
      case "INVALID_TOKEN_SIGNATURE":
        statusCode = 401;
        break;
      case "TOKEN_EXPIRED":
        statusCode = 401;
        break;
      default:
        console.error("Unknown error", error);
    }
    return {
      statusCode,
      body: JSON.stringify({ error: errorMessage }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
