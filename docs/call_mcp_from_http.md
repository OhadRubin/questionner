# Calling an MCP Server from HTTP/Browser

Using Streamable HTTP transport with raw `fetch` or the official SDK.

## Raw Fetch (No SDK)

```javascript
const MCP_ENDPOINT = "http://localhost:3000/mcp";
let sessionId = null;

async function mcpRequest(method, params = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  // Capture session ID from first response
  const newSessionId = response.headers.get("Mcp-Session-Id");
  if (newSessionId) {
    sessionId = newSessionId;
  }

  return response.json();
}

async function initialize() {
  return mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    clientInfo: { name: "browser-client", version: "1.0.0" },
    capabilities: {}
  });
}

async function listTools() {
  return mcpRequest("tools/list");
}

async function callTool(name, args) {
  return mcpRequest("tools/call", { name, arguments: args });
}

// Usage
async function main() {
  await initialize();

  const tools = await listTools();
  console.log("Available tools:", tools.result.tools);

  const result = await callTool("echo_context", { message: "Hello from browser!" });
  console.log("Result:", result.result);
}

main();
```

## With Official SDK (requires bundler)

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function listTools() {
  console.log("\n--- Listing Available Tools ---");

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp")
  );
  const client = new Client(
    { name: "browser-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const tools = await client.listTools();

    console.log("Available tools:");
    for (const tool of tools.tools) {
      console.log(`\nTool: ${tool.name}`);
      console.log(`Description: ${tool.description}`);
      console.log("Parameters schema:", JSON.stringify(tool.inputSchema, null, 2));
    }
  } finally {
    await client.close();
  }
}

async function callWithUser(userId, authToken, message) {
  console.log(`\n--- Calling as user: ${userId} ---`);

  const headers = {
    "X-User-ID": userId,
    "Accept": "application/json, text/event-stream"
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp"),
    { requestInit: { headers } }
  );
  const client = new Client(
    { name: "browser-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: "echo_context", arguments: { message } });
    console.log("Result:", result);
  } finally {
    await client.close();
  }
}

async function main() {
  await listTools();
  await callWithUser("alice", "alice-token-123", "Hello from Alice!");
  await callWithUser("bob", "bob-token-456", "Hello from Bob!");
  await callWithUser("anonymous", "", "Hello without auth!");
}

main();
```

## Note

- **Session management**: The server may return `Mcp-Session-Id` header on first response. Include it in all subsequent requests.
- **Protocol version**: Use `2025-03-26` (Streamable HTTP). Older `2024-11-05` uses deprecated SSE transport.
- **CORS**: Server must allow cross-origin requests if called from browser on different domain.
- Using request headers, you can inject user context (ID, auth token) for per-user tool execution.
