import { dcUrl } from "../environment.ts";
import { ApiToken } from "../api/api-token.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  try {
    const params = new URL(req.url).searchParams;
    let responseLocation =
      params.get("goto") ?? c.req.header("referer") ?? dcUrl();

    const userToken = c.get("userToken");
    if (userToken && userToken.token.provider === "nusso") {
      const url = `${process.env["NUSSO_BASE_URL"]}logout`;
      const resp = await fetch(url, {
        headers: { apikey: process.env["NUSSO_API_KEY"] ?? "" },
      });
      const data = (await resp.json()) as { url: string };
      responseLocation = data.url;
    }

    c.set("userToken", new ApiToken().expire());
    return new Response(null, {
      status: 302,
      headers: { location: responseLocation },
    });
  } catch (error) {
    console.error("NUSSO request error", error);
    return new Response(null, { status: 401 });
  }
};
