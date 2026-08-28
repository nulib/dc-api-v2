import { DC_RESOURCE_ORIGINS } from "./config.js";
import { McpServer } from "@modelcontextprotocol/server";
import type { McpRequestContext } from "@modelcontextprotocol/server";
import GetWorkTool from "./tools/get-work.js";
import ListCollectionsTool from "./tools/list-collections.js";
import SearchTool from "./tools/search-works.js";
import SimilaritySearchTool from "./tools/similarity-search.js";
import ViewCollectionTool from "./tools/view-collection.js";
import ViewSearchResultsTool from "./tools/view-search-results.js";
import ViewSimilarWorksTool from "./tools/view-similar-works.js";
import ViewWorkTool from "./tools/view-work.js";
import { CloverUIResource } from "@nulib/clover-mcp";
import { logRequest, withToolLogging } from "./common/logging.js";
import version from "./common/version.js";

const CLOVER_RESOURCE_URI = "ui://clover-viewer/mcp-app.html";
export const createServer = (ctx?: McpRequestContext) => {
  logRequest(ctx);

  const server = new McpServer(
    {
      name: "dc-api-mcp",
      description: "A MCP server for the Digital Collections API",
      version
    },
    {
      // Tool list and UI resource are static per deploy (SEP-2549 cache hints)
      cacheHints: {
        "tools/list": { ttlMs: 3_600_000, cacheScope: "public" },
        "resources/list": { ttlMs: 3_600_000, cacheScope: "public" },
        "resources/read": { ttlMs: 3_600_000, cacheScope: "public" }
      }
    }
  );

  server.registerTool(
    SearchTool.name,
    SearchTool.config,
    withToolLogging(SearchTool.name, SearchTool.handler)
  );

  server.registerTool(
    GetWorkTool.name,
    GetWorkTool.config,
    withToolLogging(GetWorkTool.name, GetWorkTool.handler)
  );

  server.registerTool(
    ListCollectionsTool.name,
    ListCollectionsTool.config,
    withToolLogging(ListCollectionsTool.name, ListCollectionsTool.handler)
  );

  server.registerTool(
    SimilaritySearchTool.name,
    SimilaritySearchTool.config,
    withToolLogging(SimilaritySearchTool.name, SimilaritySearchTool.handler)
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
    withToolLogging(ViewWorkTool.name, ViewWorkTool.handler)
  );

  uiResource.registerTool(
    server,
    ViewCollectionTool.name,
    ViewCollectionTool.config,
    withToolLogging(ViewCollectionTool.name, ViewCollectionTool.handler)
  );

  uiResource.registerTool(
    server,
    ViewSearchResultsTool.name,
    ViewSearchResultsTool.config,
    withToolLogging(ViewSearchResultsTool.name, ViewSearchResultsTool.handler)
  );

  uiResource.registerTool(
    server,
    ViewSimilarWorksTool.name,
    ViewSimilarWorksTool.config,
    withToolLogging(ViewSimilarWorksTool.name, ViewSimilarWorksTool.handler)
  );

  uiResource.registerResource(server);

  return server;
};
