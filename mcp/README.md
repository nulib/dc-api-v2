# dc-api-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Northwestern University Library's [Digital Collections API](https://api.dc.library.northwestern.edu/api/v2) as tools for AI assistants.

## Tools

| Tool | Description |
|------|-------------|
| `search` | Search Digital Collections by metadata fields (title, creator, subject, collection, work type, license, rights statement, etc.) |
| `semantic-search` | Search Digital Collections using a natural language query with neural/vector search |

## Requirements

- Node.js 24+ (see [.tool-versions](.tool-versions))
- [mise](https://mise.jdx.dev/) (used by `bin/run.sh` to activate the correct runtime)

## Setup

```bash
cd src
npm install
```

## Configuration

The server reads the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DC_API_BASE` | `https://api.dc.library.northwestern.edu/api/v2` | Base URL for the Digital Collections API |
| `SEARCH_MODEL_ID` | _(none)_ | OpenSearch model ID used for semantic/neural search |

## Running locally

### stdio (for Claude Desktop / Claude Code)

```bash
cd src
npm run stdio
```

Or via the wrapper script:

```bash
bin/run.sh
```

### HTTP (Streamable HTTP transport, port 3000)

```bash
cd src
npm run http
```

## Configuring Claude Desktop

Add the following entry to your Claude Desktop configuration file.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dc-api": {
      "command": "/path/to/dc-api-mcp/bin/run.sh"
    }
  }
}
```

Replace `/path/to/dc-api-mcp` with the absolute path to this repository on your machine.

If you need to override the API base URL or supply a semantic search model ID, pass them as environment variables:

```json
{
  "mcpServers": {
    "dc-api": {
      "command": "/path/to/dc-api-mcp/bin/run.sh",
      "env": {
        "DC_API_BASE": "https://api.dc.library.northwestern.edu/api/v2",
        "SEARCH_MODEL_ID": "your-model-id"
      }
    }
  }
}
```

After editing the file, restart Claude Desktop for the changes to take effect. You should see the `dc-api` server listed under the MCP tools panel.

## Deployment (AWS Lambda)

The server can also be deployed as an AWS Lambda function using the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

```bash
sam local start-api  # local testing
sam deploy           # deploy to AWS
```

Runtime parameters (`DcApiBase`, `SearchModelId`) are configured in [samconfig.yaml](samconfig.yaml).

## License

Apache-2.0
