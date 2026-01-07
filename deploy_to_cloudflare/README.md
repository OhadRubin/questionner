# Israel Time MCP Server

A simple MCP server that provides current time in Israel, deployed on Cloudflare Workers.

## Tools

- **get_israel_time**: Returns the current time in Israel with multiple formats
- **is_before_hour**: Checks if current Israel time is before a specific hour (useful for time-based rules)

## Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare (if not already)
npx wrangler login

# Run locally
npm start

# Deploy to Cloudflare
npm run deploy
```

## Usage

After deploying, your MCP server will be available at:
- SSE endpoint: `https://israel-time-mcp.<your-subdomain>.workers.dev/sse`
- Streamable HTTP: `https://israel-time-mcp.<your-subdomain>.workers.dev/mcp`

### Add to Claude.ai

Once deployed, add this URL to your Claude.ai MCP connectors:
`https://israel-time-mcp.<your-subdomain>.workers.dev/sse`

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Then connect to your server URL.

## Example Responses

### get_israel_time
```json
{
  "time": "19:45:30",
  "time_12h": "7:45:30 PM",
  "date": "2026-01-06",
  "day": "Tuesday",
  "timezone": "Asia/Jerusalem",
  "iso": "2026-01-06T17:45:30.000Z"
}
```

### is_before_hour(18)
```json
{
  "current_hour": 19,
  "target_hour": 18,
  "is_before": false,
  "current_time": "19:45"
}
```
