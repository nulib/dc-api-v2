import { ProviderCapabilities } from "../environment.ts";
import { errorMessage } from "../helpers.ts";
import { handler as nussoLogin } from "./auth/nusso-login.ts";
import { handler as nussoCallback } from "./auth/nusso-callback.ts";
import { handler as magicLogin } from "./auth/magic-login.ts";
import { handler as magicCallback } from "./auth/magic-callback.ts";
import type { Context } from "hono";
import type { AppEnv } from "../types.ts";

const DEFAULT_PROVIDER = "nusso";

type ProviderHandler = (c: Context<AppEnv>) => Promise<Response>;

const PROVIDER_HANDLERS: Record<string, Record<string, ProviderHandler>> = {
  nusso: { login: nussoLogin, callback: nussoCallback },
  magic: { login: magicLogin, callback: magicCallback },
};

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  const provider = c.req.param("provider") ?? DEFAULT_PROVIDER;
  const stage = c.req.param("stage") ?? "login";

  const capabilities = ProviderCapabilities() as Record<string, string[]>;
  if (!capabilities[provider]) {
    return new Response(
      JSON.stringify({ error: `Unknown provider: '${provider}'` }),
      { status: 404 },
    );
  }

  if (!capabilities[provider].includes("login")) {
    return new Response(
      JSON.stringify({
        error: `Login not enabled for provider '${provider}'`,
      }),
      { status: 404 },
    );
  }

  try {
    console.info(`Delegating to provider module: ./auth/${provider}-${stage}`);
    const providerHandler = PROVIDER_HANDLERS[provider]?.[stage];
    if (!providerHandler) {
      return new Response(
        JSON.stringify({ error: `Provider module not found: ${provider}` }),
        { status: 404 },
      );
    }
    return await providerHandler(c);
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 500,
    });
  }
};
