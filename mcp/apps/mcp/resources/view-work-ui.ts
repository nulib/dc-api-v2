import { DC_API_BASE, DC_IIIF_BASE, VIEWER_PATH } from "../config.js";

export const UI_RESOURCE_URI = "ui://clover-viewer/mcp-app.html";
export const API_BASE_ORIGIN = new URL(DC_API_BASE).origin;
export const IIIF_BASE_ORIGIN = new URL(DC_IIIF_BASE).origin;
import { readFile } from "node:fs/promises";
import * as path from "node:path";

export const name = UI_RESOURCE_URI;

export const uri = UI_RESOURCE_URI;

export const config = {
  description: "UI resource for the View Work tool",
  mimeType: "text/html"
};

export const handler = async () => {
  const filePath = path.resolve(process.cwd(), VIEWER_PATH, "index.html");
  const html = await readFile(filePath, "utf-8");
  return {
    contents: [
      {
        uri: "ui://clover-viewer/mcp-app.html",
        text: html,
        mimeType: "text/html;profile=mcp-app",
        _meta: {
          ui: {
            csp: {
              resourceDomains: [API_BASE_ORIGIN, IIIF_BASE_ORIGIN],
              connectDomains: [API_BASE_ORIGIN, IIIF_BASE_ORIGIN]
            }
          }
        }
      }
    ]
  };
};

export default { name, uri, config, handler };
