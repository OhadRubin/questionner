import logging
from fastmcp import FastMCP, Context

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-server")

mcp = FastMCP("Echo Context Server")

@mcp.tool()
async def echo_context(message: str, ctx: Context) -> dict:
    """Echo back the message and user context from request headers."""
    request = ctx.get_http_request()
    
    user_id = request.headers.get("X-User-ID", "unknown")
    auth_token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    
    logger.info(f"Request from user: {user_id}")
    
    return {
        "message": message,
        "user_context": {
            "user_id": user_id,
            "auth_token": f"{auth_token[:5]}..." if auth_token else "none"
        }
    }

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=3000)
