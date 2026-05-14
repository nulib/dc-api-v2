import Honeybadger from "@honeybadger-io/js";
import type { Context } from "hono";
import { errorMessage } from "../helpers.ts";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  try {
    return new Response(JSON.stringify(c.get("userToken").userInfo()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    await Honeybadger.notifyAsync(error as Error);
    return new Response("Error verifying API token: " + errorMessage(error), {
      status: 401,
    });
  }
};
