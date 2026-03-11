import { DC_RESOURCE_ORIGINS } from "./config.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import GetWorkTool from "./tools/get-work.js";
import ListCollectionsTool from "./tools/list-collections.js";
import SearchTool from "./tools/search-works.js";
import SimilaritySearchTool from "./tools/similarity-search.js";
import ViewCollectionTool from "./tools/view-collection.js";
import ViewSearchResultsTool from "./tools/view-search-results.js";
import ViewSimilarWorksTool from "./tools/view-similar-works.js";
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

  server.registerTool(
    GetWorkTool.name,
    GetWorkTool.config,
    GetWorkTool.handler
  );

  server.registerTool(
    ListCollectionsTool.name,
    ListCollectionsTool.config,
    ListCollectionsTool.handler
  );

  server.registerTool(
    SimilaritySearchTool.name,
    SimilaritySearchTool.config,
    SimilaritySearchTool.handler
  );

  const uiResource = new CloverUIResource({
    resourceUri: CLOVER_RESOURCE_URI,
    description: "UI resource for the View Work tool",
    resourceDomains: DC_RESOURCE_ORIGINS,
    connectDomains: DC_RESOURCE_ORIGINS
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

  uiResource.registerTool(
    server,
    ViewSearchResultsTool.name,
    ViewSearchResultsTool.config,
    ViewSearchResultsTool.handler
  );

  uiResource.registerTool(
    server,
    ViewSimilarWorksTool.name,
    ViewSimilarWorksTool.config,
    ViewSimilarWorksTool.handler
  );

  uiResource.registerResource(server);

  return server;
};
