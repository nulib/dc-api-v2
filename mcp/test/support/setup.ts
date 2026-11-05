import * as fs from "node:fs";
import * as path from "node:path";
import { fromTraffic } from "@msw/source/traffic";
import { setupServer } from "msw/native";
import { setDefaultTimeout } from "bun:test";

// Every test file imports this module rather than relying on a `preload` in
// `bunfig.toml`, because a runner that starts somewhere other than this
// package — the VS Code extension runs the whole monorepo from the workspace
// root — never finds that config. Anything the suite needs set up globally
// belongs here, where an import carries it.

// Recording is opt-in; everything else replays the committed fixtures rather
// than reaching the live API.
process.env.MSW_MODE ||= "replay";
process.env.SECRETS_PATH = ""; // Disable AWS Secrets Manager in replay tests

// The MCP server boots an in-memory transport per test; 5s isn't always enough.
setDefaultTimeout(20000);
if (process.env.MSW_MODE === "record") {
  console.log("Recording HTTP interactions to fixtures...");
}

if (process.env.MSW_MODE === "replay") {
  const traffic = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../fixtures/interactions.har"),
      "utf-8"
    )
  );
  const entries = traffic?.log?.entries ?? [];
  if (entries.length > 0) {
    console.log("Replaying HTTP interactions from fixtures...");
    const handlers = [...fromTraffic(traffic)] as unknown as Parameters<typeof setupServer>;
    const server = setupServer(...handlers);
    server.listen({
      onUnhandledRequest: (request, print) => {
        // Tests exercise the local Express bridge over real HTTP; let
        // loopback traffic through and only error on unmocked external calls.
        const { hostname } = new URL(request.url);
        if (hostname === "localhost" || hostname === "127.0.0.1") return;
        print.error();
      }
    });
  } else {
    console.log("No HAR fixtures found, running against live API...");
  }
}
