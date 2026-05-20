import Honeybadger from "@honeybadger-io/js";
import type { Context } from "hono";
import { errorMessage } from "../helpers.ts";
import type { AppEnv } from "../types.ts";

const DEFAULT_TTL = 86400;
const MAX_TTL = DEFAULT_TTL * 7;

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const params = new URL(req.url).searchParams;
  try {
    const ttl = params.get("ttl");
    if (ttl !== null && ttl !== "" && /\D/.test(ttl)) {
      return new Response(`'${ttl}' is not a valid value for ttl`, {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }
    const ttl_in_seconds = Number(ttl) || DEFAULT_TTL;
    if (ttl_in_seconds > MAX_TTL) {
      return new Response(`ttl cannot exceed ${MAX_TTL} seconds`, {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const token = c.get("userToken");
    const expiration = new Date(new Date().getTime() + ttl_in_seconds * 1000);
    expiration.setMilliseconds(0);
    token.expireAt(expiration);

    return new Response(
      JSON.stringify({
        token: await token.sign(),
        expires: expiration.toISOString(),
      }),
      { status: 200 },
    );
  } catch (error) {
    await Honeybadger.notifyAsync(error as Error);
    return new Response("Error verifying API token: " + errorMessage(error), {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }
};
