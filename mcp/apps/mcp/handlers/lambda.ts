import { streamableHttpHandler } from "./lambdaStreamableHttp.js";
import { createServer } from "../server.js";
process.setSourceMapsEnabled?.(true);

export const handler = streamableHttpHandler(createServer());
