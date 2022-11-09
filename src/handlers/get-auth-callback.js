const axios = require("axios").default;
const cookie = require("cookie");
const { processRequest, processResponse } = require("./middleware");
const ApiToken = require("../api/api-token");

const BAD_DIRECTORY_SEARCH_FAULT =
  /Reason: ResponseCode 404 is treated as error/;

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
    event.userToken = new ApiToken().user(user);
    event._userTokenUpdated = true;
    response = {
      statusCode: 302,
      cookies: [
        cookie.serialize("redirectUrl", null, {
          expires: new Date(1),
        }),
      ],
      headers: {
        location: returnPath,
      },
    };
  }

  return processResponse(event, response);
};

async function getNetIdFromToken(nusso) {
  const response = await axios.get(
    `${process.env.NUSSO_BASE_URL}validateWebSSOToken`,
    {
      headers: {
        apikey: process.env.NUSSO_API_KEY,
        webssotoken: nusso,
      },
    }
  );
  return response?.data?.netid;
}

async function redeemSsoToken(event) {
  const nusso = event.cookieObject.nusso;
  const netid = await getNetIdFromToken(nusso);
  if (netid) {
    try {
      const response = await axios.get(
        `${process.env.NUSSO_BASE_URL}validate-with-directory-search-response`,
        {
          headers: {
            apikey: process.env.NUSSO_API_KEY,
            webssotoken: nusso,
          },
        }
      );
      return { ...response.data.results[0], uid: netid };
    } catch (err) {
      if (
        BAD_DIRECTORY_SEARCH_FAULT.test(err?.response?.data?.fault?.faultstring)
      ) {
        return redeemForNetIdOnly(netid);
      }
      console.error(err.response.data);
      return null;
    }
  } else {
    console.warn("NUSSO token could not be redeemed");
    return null;
  }
}

function redeemForNetIdOnly(netid) {
  return {
    uid: netid,
    displayName: [netid],
    mail: `${netid}@e.northwestern.edu`,
  };
}
