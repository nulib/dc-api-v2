import * as fs from "node:fs";
import * as path from "node:path";
import { fromTraffic } from "@msw/source/traffic";
import { setupServer } from "msw/native";

process.env.SECRETS_PATH = ""; // Disable AWS Secrets Manager in replay tests
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
    server.listen({ onUnhandledRequest: "error" });
  } else {
    console.log("No HAR fixtures found, running against live API...");
  }
}
