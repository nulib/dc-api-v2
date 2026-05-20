import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const userToken = c.get("userToken");
  if (!userToken.can("chat")) {
    return new Response("Authorization Required", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(
    JSON.stringify({
      endpoint: process.env["WEBSOCKET_URI"],
      auth: await userToken.sign(),
    }),
    { status: 200 },
  );
};
