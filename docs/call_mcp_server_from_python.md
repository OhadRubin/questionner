# Calling an MCP Server from Python

Using `fastmcp` with Streamable HTTP transport.

## client.py

```python
import asyncio
import json
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport


async def list_tools():
    """List all available tools and their schemas"""
    print("\n--- Listing Available Tools ---")

    transport = StreamableHttpTransport(url="http://localhost:3000/mcp")
    client = Client(transport)

    try:
        async with client:
            tools = await client.list_tools()
            print("Available tools:")
            for tool in tools:
                print(f"\nTool: {tool.name}")
                print(f"Description: {tool.description}")
                print("Parameters schema:")
                print(json.dumps(tool.inputSchema, indent=2))
    except Exception as e:
        print(f"Error: {e}")


async def call_with_user(user_id, auth_token, message):
    """Call echo_context tool with specific user context in headers"""
    print(f"\n--- Calling as user: {user_id} ---")

    headers = {
        "X-User-ID": user_id,
        "Authorization": f"Bearer {auth_token}",
        "Accept": "application/json, text/event-stream"
    }

    if not auth_token:
        headers.pop("Authorization")

    transport = StreamableHttpTransport(
        url="http://localhost:3000/mcp",
        headers=headers
    )
    client = Client(transport)

    try:
        async with client:
            result = await client.call_tool("echo_context", {"message": message})
            print(f"Result: {result}")
    except Exception as e:
        print(f"Error: {e}")


async def main():
    await list_tools()
    await call_with_user("alice", "alice-token-123", "Hello from Alice!")
    await call_with_user("bob", "bob-token-456", "Hello from Bob!")
    await call_with_user("anonymous", "", "Hello without auth!")


if __name__ == "__main__":
    asyncio.run(main())
```

## Note

Using request headers and the `ctx` object, you can inject the user's ID/name on behalf of whom you are executing a tool call.
