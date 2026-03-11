import { ProxyAgent, setGlobalDispatcher } from "undici";
import * as fs from "node:fs";
import * as path from "node:path";
import { fromTraffic } from "@msw/source/traffic";
import { setupServer } from "msw/node";

if (process.env.MSW_MODE === "record") {
  console.log("Recording HTTP interactions to fixtures...");

  setGlobalDispatcher(
    new ProxyAgent({
      uri: "http://localhost:8080",
      requestTls: {
        ca: fs.readFileSync(
          process.env.HOME + "/.mitmproxy/mitmproxy-ca-cert.pem"
        )
      },
      proxyTls: {
        ca: fs.readFileSync(
          process.env.HOME + "/.mitmproxy/mitmproxy-ca-cert.pem"
        )
      }
    })
  );
}

if (process.env.MSW_MODE === "replay") {
  process.env.SECRETS_PATH = ""; // Disable AWS Secrets Manager in replay tests
  console.log("Replaying HTTP interactions from fixtures...");
  const traffic = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../fixtures/interactions.har"),
      "utf-8"
    )
  );
  const handlers = [...fromTraffic(traffic)];
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: "error" });
}
