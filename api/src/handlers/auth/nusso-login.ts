import { baseUrl } from "../../helpers.ts";
import { serialize as cookieSerialize } from "cookie";
import Honeybadger from "@honeybadger-io/js";
import type { Context } from "hono";
import type { AppEnv } from "../../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const base = baseUrl(c);
  const callbackUrl = new URL("auth/callback/nusso", base);
  const url = `${process.env["NUSSO_BASE_URL"]}get-ldap-redirect-url`;
  const params = new URL(c.req.url).searchParams;
  const returnPath =
    params.get("goto") ??
    c.req.header("referer") ??
    new URL("auth/whoami", base).toString();

  if (!returnPath) {
    return new Response(null, { status: 400 });
  }

  try {
    const headers = new Headers({
      apikey: process.env["NUSSO_API_KEY"] ?? "",
      goto: callbackUrl.toString(),
    });
    const resp = await fetch(url, {
      method: "GET",
      headers,
    });
    const data = (await resp.json()) as { redirecturl: string };

    return new Response(null, {
      status: 302,
      headers: {
        location: data.redirecturl,
        "set-cookie": cookieSerialize("redirectUrl", btoa(returnPath)),
      },
    });
  } catch (error) {
    await Honeybadger.notifyAsync(error as Error, {
      tags: ["auth", "upstream"],
    });
    console.error("NUSSO request error", error);
    return new Response(null, { status: 401 });
  }
};
