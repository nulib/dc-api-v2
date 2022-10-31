const axios = require("axios").default;
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { processRequest, processResponse } = require("./middleware");

/**
 * NUSSO auth callback
 */
exports.handler = async (event) => {
  event = processRequest(event);

  const returnPath = Buffer.from(
    decodeURIComponent(event.cookieObject.redirectUrl),
    "base64"
  ).toString("utf8");

  const user = await redeemSsoToken(event);
  let response;
  if (user) {
    const token = jwt.sign(user, process.env.API_TOKEN_SECRET);
    response = {
      statusCode: 302,
      cookies: [
        cookie.serialize("dcApiV2Token", token, {
          domain: "library.northwestern.edu",
          path: "/",
          secure: true,
        }),
      ],
      headers: {
        location: returnPath,
      },
    };
  }

  return processResponse(event, response);
};

async function redeemSsoToken(event) {
  if (event.cookieObject.nusso) {
    try {
      const response = await axios.get(
        `${process.env.NUSSO_BASE_URL}validate-with-directory-search-response`,
        {
          headers: {
            apikey: process.env.NUSSO_API_KEY,
            webssotoken: event.cookieObject.nusso,
          },
        }
      );
      const user = response.data.results[0];
      return user;
    } catch (err) {
      if ((err = ~/Reason: ResponseCode 404 is treated as error/)) {
        return await redeemForNetIdOnly(event);
      }
      console.error(err);
      return null;
    }
  } else {
    console.warn("No NUSSO token found in request");
    return null;
  }
}

async function redeemForNetIdOnly(event) {
  if (event.cookieObject.nusso) {
    try {
      const response = await axios.get(
        `${process.env.NUSSO_BASE_URL}validateWebSSOToken`,
        {
          headers: {
            apikey: process.env.NUSSO_API_KEY,
            webssotoken: event.cookieObject.nusso,
          },
        }
      );
      const { netid } = response.data;
      const user = {
        uid: netid,
        displayName: netid,
        givenName: netid,
        sn: "(NetID)",
        mail: `${netid}@e.northwestern.edu`,
      };
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
