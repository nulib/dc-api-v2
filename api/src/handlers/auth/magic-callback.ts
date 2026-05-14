import { verifyMagicToken } from "./magic-link.ts";
import { ApiToken } from "../../api/api-token.ts";
import type { Context } from "hono";
import type { AppEnv } from "../../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const { email, returnUrl } = await verifyMagicToken(
      decodeURIComponent(token),
    );
    const user = { sub: email, name: email };
    console.info("User", user.sub, "logged in via magic link");
    c.set("userToken", new ApiToken().user(user).provider("magic"));
    return new Response(null, {
      status: 302,
      headers: { location: returnUrl },
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    let status = 500;
    switch (err.code) {
      case "INVALID_TOKEN_SIGNATURE":
      case "TOKEN_EXPIRED":
        status = 401;
        break;
      default:
        console.error("Unknown error", error);
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
