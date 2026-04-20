# dc-api-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Northwestern University Library's [Digital Collections](https://dc.library.northwestern.edu/) as tools for AI assistants. It provides tools for searching, browsing, and retrieving metadata and IIIF manifests for digitized library materials.

## Available Tools

| Tool                  | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `search`              | Search for works using field-based and/or natural language queries |
| `similarity-search`   | Find works visually or semantically similar to a given work        |
| `get-work`            | Retrieve full metadata for a single work by ID                     |
| `view-work`           | View a work's IIIF manifest for display in compatible viewers      |
| `list-collections`    | List available digital collections                                 |
| `view-collection`     | Browse a specific collection's IIIF manifest                       |
| `view-search-results` | Retrieve results from a previous search                            |
| `view-similar-works`  | Retrieve results from a previous similarity search                 |

## Using the Remote Endpoint

The server is available as a hosted remote at:

```
https://api.dc.library.northwestern.edu/api/v2/mcp
```

No local installation is required. Configure your MCP client to connect to this URL using the streamable HTTP transport.

### Claude Desktop

Add the following to your Claude Desktop configuration file.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dc-api": {
      "type": "http",
      "url": "https://api.dc.library.northwestern.edu/api/v2/mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http dc-api https://api.dc.library.northwestern.edu/api/v2/mcp
```

---

## Development

### Requirements

- Node.js 24+ (see [.tool-versions](.tool-versions))
- [mise](https://mise.jdx.dev/) (used by `bin/run.sh` to activate the correct runtime)

### Setup

```bash
npm install
```

### Configuration

The server reads the following environment variables:

| Variable       | Default                                           | Description                              |
| -------------- | ------------------------------------------------- | ---------------------------------------- |
| `DC_API_BASE`  | `https://api.dc.library.northwestern.edu/api/v2`  | Base URL for the Digital Collections API |
| `DC_IIIF_BASE` | `https://iiif.dc.library.northwestern.edu/iiif/3` | Base URL for the IIIF server             |
| `SECRETS_PATH` | _(none)_                                          | Base path for AWS Secrets Manager config |

### Running locally

#### stdio (for Claude Desktop / Claude Code)

```bash
npm run stdio
```

Or via the wrapper script (activates the correct Node.js version via mise):

```bash
bin/run.sh
```

#### HTTP (Streamable HTTP transport, port 3000)

```bash
npm run http
```

### Configuring Claude Desktop (local build)

```json
{
  "mcpServers": {
    "dc-api": {
      "command": "/path/to/dc-api-v2/mcp/bin/run.sh"
    }
  }
}
```

Replace `/path/to/dc-api-v2/mcp` with the absolute path to this directory. Restart Claude Desktop after editing.

### Tests

| Command             | Result                                                       |
| ------------------- | ------------------------------------------------------------ |
| `npm run test`      | Run the test suite                                           |
| `npm test:watch`    | Run the test suite, watching for changes                     |
| `npm test:coverage` | Run the test suite and calculate coverage                    |
| `npm test:record`   | Run the test suite against live data and record new fixtures |

- By default, the test suite uses pre-recorded HTTP fixtures. Set `MSW_MODE=live` to run against live data.
- `npm test:record` records new fixtures (requires `mitmproxy`: `pip install mitmproxy`).
