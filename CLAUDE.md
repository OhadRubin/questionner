# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

QA Flow - an MCP-based system for presenting structured multi-choice questions to users via browser artifacts. Designed to replicate Claude Code's `AskUserQuestions` tool schema over MCP.

## Running the Server

```bash
uv run --with fastmcp --with uvicorn server/qa_server.py
```

Server runs on `http://localhost:3000/mcp` with Streamable HTTP transport.

## Architecture

```
┌─────────────┐     qa_register      ┌─────────────┐
│  Assistant  │ ──────────────────▶  │  MCP Server │
│  (Claude)   │                      │  (FastMCP)  │
│             │  wait_for_user_answer│             │
│             │ ◀═══════════════════ │  In-memory  │
│             │      (blocks)        │  sessions   │
└─────────────┘                      └─────────────┘
                                           ▲
                                           │ qa_get_questions
                                           │ qa_submit
                                           │
                                     ┌─────────────┐
                                     │   Browser   │
                                     │  (HTML/JS)  │
                                     └─────────────┘
```

## MCP Tools

| Tool | Caller | Behavior |
|------|--------|----------|
| `qa_register(questions)` | Assistant | Creates session with questions, returns `artifact_id` |
| `qa_get_questions(artifact_id)` | Browser | Fetches questions for rendering |
| `qa_submit(artifact_id, answers)` | Browser | Stores answers, unblocks waiter via `asyncio.Event` |
| `wait_for_user_answer(artifact_id)` | Assistant | **Blocks** until `qa_submit` is called |

## Key Implementation Details

- Sessions stored in `qa_sessions` dict: `{artifact_id: {questions, answers, event}}`
- Blocking achieved via `asyncio.Event.wait()` / `.set()`
- CORS middleware required for browser access (configured via `mcp.http_app(middleware=...)`)
- Browser parses SSE responses (server returns `text/event-stream`)

## Skill

`qa-flow-skill/` contains a Claude Code skill with:
- `SKILL.md` - instructions for using the QA flow
- `assets/qa_template.html` - browser UI template (inject `{{ARTIFACT_ID}}` before serving)

## Testing

```bash
# Full flow test with separate clients
uv run --with fastmcp python -c "
import asyncio
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

async def test():
    client = Client(StreamableHttpTransport(url='http://localhost:3000/mcp'))
    async with client:
        # Register
        reg = await client.call_tool('qa_register', {'questions': [...]})
        artifact_id = reg.data['artifact_id']

        # Wait (will block until browser submits)
        result = await client.call_tool('wait_for_user_answer', {'artifact_id': artifact_id})
        print(result.data['answers'])

asyncio.run(test())
"
```
