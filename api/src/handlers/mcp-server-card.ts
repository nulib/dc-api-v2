import type { Context } from "hono";
import type { AppEnv } from "../types.ts";
import { baseUrl } from "../helpers";
import status from "http-status-codes";
import { version } from "../../package.json" with { type: "json" };

export const handler = async (c: Context<AppEnv>) => {
  return new Response(
    JSON.stringify({
      $schema:
        "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: "io.github.nulib/dc-api",
      version,
      description:
        "Connect AI assistants to Northwestern University Libraries Digital Collections - enabling seamless discovery, display, and retrieval of digital assets.",
      title: "Northwestern University Libraries Digital Collections API",
      websiteUrl: "https://github.com/nulib/dc-api-v2",
      repository: {
        url: "https://github.com/nulib/dc-api-v2",
        source: "github",
        id: "519294531",
      },
      remotes: [
        {
          type: "streamable-http",
          url: new URL("mcp", baseUrl(c)).toString(),
        },
      ],
    }),
    {
      status: status.OK,
      headers: { "content-type": "application/json" },
    },
  );
};
