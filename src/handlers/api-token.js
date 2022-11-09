const { dcApiEndpoint } = require("../aws/environment");
const jwt = require("jsonwebtoken");

function dcApiToken(user, _entitlements) {
  const token = {
    iss: dcApiEndpoint(),
    sub: user?.uid,
    exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60, // 12 hours
    iat: Math.floor(Number(new Date()) / 1000),
    name: user?.displayName?.[0],
    email: user?.mail,
  };

  return jwt.sign(token, process.env.API_TOKEN_SECRET);
}

module.exports = { dcApiToken };
