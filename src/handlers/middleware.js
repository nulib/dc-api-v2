const { decodeEventBody, normalizeHeaders } = require("../helpers");

module.exports = function (event) {
  let result = normalizeHeaders(event);
  result = decodeEventBody(result);
  return result;
};
