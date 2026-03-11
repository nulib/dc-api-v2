# dc-api-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Northwestern University Library's [Digital Collections API](https://api.dc.library.northwestern.edu/api/v2) as tools for AI assistants.

## Requirements

- Node.js 24+ (see [.tool-versions](.tool-versions))
- [mise](https://mise.jdx.dev/) (used by `bin/run.sh` to activate the correct runtime)

## Setup

```bash
npm install
```

## Configuration

The server reads the following environment variables:

| Variable       | Default                                           | Description                                                          |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `DC_API_BASE`  | `https://api.dc.library.northwestern.edu/api/v2`  | Base URL for the Digital Collections API                             |
| `DC_IIIF_BASE` | `https://iiif.dc.library.northwestern.edu/iiif/3` | Base URL for the Digital Collections API                             |
| `SECRETS_PATH` | _(none)_                                          | The base secrets path to load configuration from AWS Secrets Manager |

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
      "command": "/path/to/dc-api/mcp/bin/run.sh"
    }
  }
}
```

Replace `/path/to/dc-api/mcp` with the absolute path to this directory on your machine.

If you need to override the API base URL or supply a semantic search model ID, pass them as environment variables:

```json
{
  "mcpServers": {
    "dc-api": {
      "command": "/path/to/dc-api/mcp/bin/run.sh",
      "env": {
        "DC_API_BASE": "https://api.dc.library.northwestern.edu/api/v2",
        "DC_IIIF_BASE": "https://iiif.dc.library.northwestern.edu/iiif/3"
      }
    }
  }
}
```

After editing the file, restart Claude Desktop for the changes to take effect. You should see the `dc-api` server listed under the MCP tools panel.

## Tests

There are several ways to invoke the test suite:

| Command             | Result                                                       |
| ------------------- | ------------------------------------------------------------ |
| `npm run test`      | Run the test suite                                           |
| `npm test:watch`    | Run the test suite, watching for changes                     |
| `npm test:coverage` | Run the test suite and calculate coverage                    |
| `npm test:record`   | Run the test suite against live data and record new fixtures |

- By default, the test suite uses pre-recorded HTTP fixtures. You can set `MSW_MODE=live` to run against live data.
- `npm test:record` will record new test fixtures (requires `mitmproxy`, which can be installed with `pip install mitmproxy`).
