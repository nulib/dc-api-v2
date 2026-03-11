import { streamableHttpHandler } from "./lambdaStreamableHttp.js";
import { createServer } from "./server.js";

export const handler = streamableHttpHandler(createServer());
