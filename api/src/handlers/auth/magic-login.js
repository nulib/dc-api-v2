const { dcApiEndpoint } = require("../../environment");
const { createMagicToken } = require("./magic-link");
const { SESClient, SendTemplatedEmailCommand } = require("@aws-sdk/client-ses");

const { MAGIC_LINK_EMAIL_TEMPLATE, REPOSITORY_EMAIL } = process.env;

exports.handler = async (event, context) => {
  const callbackUrl = new URL(`${dcApiEndpoint()}/auth/callback/magic`);

  const returnUrl =
    event.queryStringParameters?.goto ||
    event.headers?.referer ||
    `${dcApiEndpoint()}/auth/whoami`;

  const email = event.queryStringParameters?.email;
  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email is required" }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  const { token, expiration } = createMagicToken(email, returnUrl);
  callbackUrl.searchParams.set("token", token);
  const magicLink = callbackUrl.toString();

  const sesClient = context?.injections?.sesClient || new SESClient({});

  const cmd = new SendTemplatedEmailCommand({
    Destination: { ToAddresses: [email] },
    TemplateData: JSON.stringify({ magicLink }),
    Source: `Northwestern University Libraries <${REPOSITORY_EMAIL}>`,
    Template: MAGIC_LINK_EMAIL_TEMPLATE,
  });

  try {
    await sesClient.send(cmd);
    console.info("Magic link sent to <%s>", email);
  } catch (err) {
    console.error("Failed to send template email", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to send email",
        reason: err.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Magic link sent",
      email,
      expires: new Date(expiration),
    }),
  };
};
