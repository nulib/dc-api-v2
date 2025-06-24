const { wrap } = require("./middleware");
const { ProviderCapabilities } = require("../environment");

const DEFAULT_PROVIDER = "nusso";

exports.handler = wrap(async (event, context) => {
  const provider = event.pathParameters.provider || DEFAULT_PROVIDER;
  const stage = event.pathParameters.stage || "login";

  const capabilities = ProviderCapabilities();
  if (!capabilities[provider]) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `Unknown provider: '${provider}'`,
      }),
    };
  }

  if (!capabilities[provider].includes("login")) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `Login not enabled for provider '${provider}'`,
      }),
    };
  }

  try {
    const providerModule = `./auth/${provider}-${stage}`;
    console.info("Delegating to provider module:", providerModule);
    const providerHandler = require(providerModule).handler;
    const result = await providerHandler(event, context);
    return result;
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("Module not found:", error);
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Provider module not found: ${provider}`,
        }),
      };
    }
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
});
