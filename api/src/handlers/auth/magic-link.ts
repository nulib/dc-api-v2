import { apiTokenSecret } from "../../environment.ts";

const TIMESTAMP_SIZE = 6; // 48 bits
const LINK_EXPIRATION = 15 * 60 * 1000; // 15 minutes

async function sign(data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiTokenSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data.buffer as ArrayBuffer);
  return new Uint8Array(sig).slice(0, 16);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

function makeError(message: string, code: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

export async function createMagicToken(
  email: string,
  returnUrl: string,
  expiration?: number,
): Promise<{ token: string; expiration: number }> {
  expiration = expiration ?? Date.now() + LINK_EXPIRATION;

  const ts = new Uint8Array(8);
  const view = new DataView(ts.buffer);
  view.setUint32(0, expiration >>> 0, true);
  view.setUint16(4, Math.floor(expiration / 2 ** 32), true);
  const expirationBytes = ts.slice(0, 6);

  const payloadBytes = new TextEncoder().encode([email, returnUrl].join("|"));
  const payload = new Uint8Array(payloadBytes.length + 6);
  payload.set(payloadBytes);
  payload.set(expirationBytes, payloadBytes.length);

  const signature = await sign(payload);

  const encodedPayload = btoa(String.fromCharCode(...payload)).replace(
    /=+$/,
    "",
  );
  const encodedSignature = btoa(String.fromCharCode(...signature)).replace(
    /=+$/,
    "",
  );

  return { token: encodedPayload + encodedSignature, expiration };
}

export async function verifyMagicToken(
  token: string,
): Promise<{ email: string; returnUrl: string }> {
  const signatureLength = Math.ceil((16 * 8) / 6); // 22 chars
  const encodedPayload = token.slice(0, token.length - signatureLength);
  const encodedSignature = token.slice(token.length - signatureLength);

  let payload: Uint8Array;
  let signature: Uint8Array;
  try {
    payload = Uint8Array.from(atob(encodedPayload), (c) => c.charCodeAt(0));
    signature = Uint8Array.from(atob(encodedSignature), (c) => c.charCodeAt(0));
  } catch {
    throw makeError("Invalid token signature", "INVALID_TOKEN_SIGNATURE");
  }
  const expectedSignature = await sign(payload);

  let verified: boolean;
  try {
    verified = timingSafeEqual(signature, expectedSignature);
  } catch {
    verified = false;
  }

  if (!verified) {
    throw makeError("Invalid token signature", "INVALID_TOKEN_SIGNATURE");
  }

  const payloadText = payload.subarray(0, -TIMESTAMP_SIZE);
  const [email, returnUrl] = new TextDecoder().decode(payloadText).split("|");

  const expirationBytes = payload.subarray(-TIMESTAMP_SIZE);
  const dv = new DataView(
    expirationBytes.buffer,
    expirationBytes.byteOffset,
    6,
  );
  const expiration = dv.getUint32(0, true) + dv.getUint16(4, true) * 2 ** 32;

  if (Date.now() > expiration) {
    throw makeError("Token expired", "TOKEN_EXPIRED");
  }

  return { email, returnUrl };
}
