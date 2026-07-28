import { streamableHttpHandler } from "./lambdaStreamableHttp.js";
import { mcpHandler } from "./mcpHandler.js";
process.setSourceMapsEnabled?.(true);

export const handler = streamableHttpHandler(mcpHandler);
