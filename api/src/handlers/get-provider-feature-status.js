const { wrap } = require("./middleware");
const { providersFeatures } = require("../environment");

const handler = wrap(async (event) => {
  try {
    const provider = event.pathParameters?.provider;
    const feature = event.pathParameters?.feature;

    if (!provider || !feature) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required path parameters: provider and feature",
        }),
      };
    }

    if (!Object.prototype.hasOwnProperty.call(providersFeatures(), provider)) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `Provider '${provider}' not found`,
          enabled: false,
        }),
      };
    }

    const isFeatureEnabled =
      Array.isArray(providersFeatures()[provider]) &&
      providersFeatures()[provider].includes(feature);

    return {
      statusCode: 200,
      body: JSON.stringify({
        enabled: isFeatureEnabled,
        provider,
        feature,
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
});

module.exports = { handler };
