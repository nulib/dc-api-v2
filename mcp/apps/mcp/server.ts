import { SEARCH_MODEL_ID } from "./config.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import SearchTool from "./tools/search.js";
import SemanticSearchTool from "./tools/semantic-search.js";
import ViewWorkTool from "./tools/view-work.js";
import ViewWorkUIResource from "./resources/view-work-ui.js";

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
    ViewWorkTool.name,
    ViewWorkTool.config,
    ViewWorkTool.handler
  );

  server.registerResource(
    ViewWorkUIResource.name,
    ViewWorkUIResource.uri,
    ViewWorkUIResource.config,
    ViewWorkUIResource.handler
  );

  return server;
};
