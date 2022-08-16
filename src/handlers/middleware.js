const base64 = require("base64-js");

function decodeEventBody(event) {
  if (!event.isBase64Encoded) return event;
  event.body = new Buffer.from(base64.toByteArray(event.body)).toString();
  event.isBase64Encoded = false;
  return event;
}

module.exports = { decodeEventBody };
