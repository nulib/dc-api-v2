const { apiTokenSecret } = require("../../environment");
const crypto = require("crypto");

const TIMESTAMP_SIZE = 6; // 48 bits
const LINK_EXPIRATION = 15 * 60 * 1000; // 15 minutes

const sign = (data) =>
  crypto
    .createHmac("sha256", apiTokenSecret())
    .update(data)
    .digest()
    .subarray(0, 16);

const error = (message, code) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

exports.createMagicToken = (email, returnUrl, expiration) => {
  expiration = expiration || Date.now() + LINK_EXPIRATION;
  const expirationBytes = Buffer.alloc(6);
  expirationBytes.writeUIntLE(expiration, 0, TIMESTAMP_SIZE);
  const payloadBytes = Buffer.from([email, returnUrl].join("|"), "utf-8");

  const payload = Buffer.concat([payloadBytes, expirationBytes]);
  const signature = sign(payload);

  const encodedPayload = payload.toString("base64").replace(/=+$/g, "");
  const encodedSignature = signature.toString("base64").replace(/=+$/g, "");

  const token = encodedPayload + encodedSignature;
  return { token, expiration };
};

exports.verifyMagicToken = (token) => {
  const signatureLength = Math.ceil((16 * 8) / 6); // 16 bytes = 22 encoded chars
  const encodedPayload = token.slice(0, token.length - signatureLength);
  const encodedSignature = token.slice(token.length - signatureLength);

  const payload = Buffer.from(encodedPayload, "base64");
  const expectedSignature = sign(payload);
  const signature = Buffer.from(encodedSignature, "base64");
  let verified;
  try {
    verified = crypto.timingSafeEqual(signature, expectedSignature);
  } catch (e) {
    verified = false;
  }

  if (!verified) {
    throw error("Invalid token signature", "INVALID_TOKEN_SIGNATURE");
  }

  const [email, returnUrl] = payload
    .subarray(0, -TIMESTAMP_SIZE)
    .toString("utf-8")
    .split("|");
  const expirationBytes = payload.subarray(-TIMESTAMP_SIZE);
  const expiration = expirationBytes.readUIntLE(0, TIMESTAMP_SIZE);

  if (Date.now() > expiration) {
    throw error("Token expired", "TOKEN_EXPIRED");
  }

  return { email, returnUrl };
};
