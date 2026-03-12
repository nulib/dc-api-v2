import { DC_API_ORIGIN, DC_IIIF_ORIGIN, SEARCH_MODEL_ID } from "./config.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import GetWorkTool from "./tools/get-work.js";
import SearchTool from "./tools/search.js";
import SemanticSearchTool from "./tools/semantic-search.js";
import ViewCollectionTool from "./tools/view-collection.js";
import ViewWorkTool from "./tools/view-work.js";
import { CloverUIResource } from "@nulib/clover-mcp";

const CLOVER_RESOURCE_URI = "ui://clover-viewer/mcp-app.html";

export const createServer = () => {
  const server = new McpServer({
    name: "dc-api-mcp",
    description: "A MCP server for the Digital Collections API",
    version: "2.9.4"
  });

  server.registerTool(SearchTool.name, SearchTool.config, SearchTool.handler);

  if (SEARCH_MODEL_ID) {
    server.registerTool(
      SemanticSearchTool.name,
      SemanticSearchTool.config,
      SemanticSearchTool.handler
    );
  }

  server.registerTool(
    GetWorkTool.name,
    GetWorkTool.config,
    GetWorkTool.handler
  );

  const uiResource = new CloverUIResource({
    resourceUri: CLOVER_RESOURCE_URI,
    description: "UI resource for the View Work tool",
    resourceDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN],
    connectDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN]
  });

  uiResource.registerTool(
    server,
    ViewWorkTool.name,
    ViewWorkTool.config,
    ViewWorkTool.handler
  );

  uiResource.registerTool(
    server,
    ViewCollectionTool.name,
    ViewCollectionTool.config,
    ViewCollectionTool.handler
  );

  uiResource.registerResource(server);

  return server;
};
