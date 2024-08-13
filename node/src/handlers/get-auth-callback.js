const axios = require("axios").default;
const cookie = require("cookie");
const { wrap } = require("./middleware");
const ApiToken = require("../api/api-token");
const Honeybadger = require("../honeybadger-setup");

const BAD_DIRECTORY_SEARCH_FAULT =
  /Reason: ResponseCode 404 is treated as error/;

/**
 * NUSSO auth callback
 */
exports.handler = wrap(async (event) => {
  const returnPath = Buffer.from(
    decodeURIComponent(event.cookieObject.redirectUrl),
    "base64"
  ).toString("utf8");

  const user = await redeemSsoToken(event);
  if (user) {
    event.userToken = new ApiToken().user(user);
    return {
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
  return { statusCode: 400 };
});

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
      return fillInBlanks({ ...response.data.results[0], uid: netid });
    } catch (err) {
      if (
        BAD_DIRECTORY_SEARCH_FAULT.test(err?.response?.data?.fault?.faultstring)
      ) {
        return fillInBlanks({ uid: netid });
      }
      await Honeybadger.notifyAsync(err, { tags: ["auth", "upstream"] });
      console.error(err.response.data);
      return null;
    }
  } else {
    console.warn("NUSSO token could not be redeemed");
    return null;
  }
}

function fillInBlanks(response) {
  const { uid } = response;
  response.displayName = ifEmpty(response.displayName, [uid]);
  response.mail = ifEmpty(response.mail, `${uid}@e.northwestern.edu`);
  return response;
}

function ifEmpty(val, replacement) {
  return isEmpty(val) ? replacement : val;
}

function isEmpty(val) {
  if (val === null || val === undefined) {
    return true;
  }

  if (Array.isArray(val)) {
    return val.every(isEmpty);
  }

  return val.length == 0;
}
