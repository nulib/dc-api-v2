import { ProviderCapabilities } from "../environment.ts";
import { errorMessage } from "../helpers.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  try {
    const provider = c.req.param("provider");
    const feature = c.req.param("feature");

    if (!provider || !feature) {
      return new Response(
        JSON.stringify({
          error: "Missing required path parameters: provider and feature",
        }),
        { status: 400 },
      );
    }

    const capabilities = ProviderCapabilities() as Record<string, string[]>;

    if (!Object.prototype.hasOwnProperty.call(capabilities, provider)) {
      return new Response(
        JSON.stringify({
          error: `Provider '${provider}' not found`,
          enabled: false,
        }),
        { status: 404 },
      );
    }

    const isFeatureEnabled =
      Array.isArray(capabilities[provider]) &&
      capabilities[provider].includes(feature);

    return new Response(
      JSON.stringify({ enabled: isFeatureEnabled, provider, feature }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: errorMessage(error),
      }),
      { status: 500 },
    );
  }
};
