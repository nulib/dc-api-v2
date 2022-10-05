const axios = require("axios").default;
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

/**
 * NUSSO auth callback
 */
exports.handler = async (event) => {
  const returnPath = cookie.parse(event.headers.Cookie, {
    decode: function (token) {
      return Buffer.from(token, "base64").toString("utf8");
    },
  })?.redirectUrl;

  const user = await redeemSsoToken(event);
  let response;
  if (user) {
    const token = jwt.sign(user, process.env.API_TOKEN_SECRET);
    response = {
      statusCode: 302,
      headers: {
        location: returnPath,
        "set-cookie": cookie.serialize("dcApiV2Token", token, {
          domain: "library.northwestern.edu",
          path: "/",
          secure: true,
        }),
      },
    };
  }

  return response;
};

async function redeemSsoToken(event) {
  const cookies = cookie.parse(event.headers.Cookie);

  if (cookies.nusso) {
    try {
      const response = await axios.get(
        `${process.env.NUSSO_BASE_URL}validate-with-directory-search-response`,
        {
          headers: {
            apikey: process.env.NUSSO_API_KEY,
            webssotoken: cookies.nusso,
          },
        }
      );
      const user = response.data.results[0];
      return user;
    } catch (err) {
      console.error(err);
      return null;
    }
  } else {
    console.warn("No NUSSO token found in request");
    return null;
  }
}
