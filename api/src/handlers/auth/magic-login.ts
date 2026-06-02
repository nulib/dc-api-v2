import { dcApiEndpoint } from "../../environment.ts";
import { errorMessage } from "../../helpers.ts";
import { createMagicToken } from "./magic-link.ts";
import { SESClient, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import type { Context } from "hono";
import type { AppEnv } from "../../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const req = c.req.raw;
  const callbackUrl = new URL(`${dcApiEndpoint()}/auth/callback/magic`);
  const params = new URL(req.url).searchParams;

  const returnUrl =
    params.get("goto") ??
    c.req.header("referer") ??
    `${dcApiEndpoint()}/auth/whoami`;

  const email = params.get("email");
  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, expiration } = await createMagicToken(email, returnUrl);
  callbackUrl.searchParams.set("token", token);
  const magicLink = callbackUrl.toString();

  const sesClient = new SESClient({});
  const cmd = new SendTemplatedEmailCommand({
    Destination: { ToAddresses: [email] },
    TemplateData: JSON.stringify({ magicLink }),
    Source: `Northwestern University Libraries <${process.env["REPOSITORY_EMAIL"]}>`,
    Template: process.env["MAGIC_LINK_EMAIL_TEMPLATE"],
  });

  try {
    await sesClient.send(cmd);
    console.info("Magic link sent to <%s>", email);
  } catch (err) {
    console.error("Failed to send template email", err);
    return new Response(
      JSON.stringify({
        error: "Failed to send email",
        reason: errorMessage(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      message: "Magic link sent",
      email,
      expires: new Date(expiration),
    }),
    { status: 200 },
  );
};
