import logging
import asyncio
import uuid
import uvicorn
from fastmcp import FastMCP, Context
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("qa-server")

mcp = FastMCP("QA Flow Server")

# In-memory storage
qa_sessions: dict[str, dict] = {}
# artifact_id -> { "questions": [...], "answers": None, "event": asyncio.Event }


@mcp.tool()
async def qa_register(questions: list[dict]) -> dict:
    """
    Register a new QA artifact with questions.

    Args:
        questions: List of question objects matching the schema:
            - question: str (the question text)
            - header: str (short label, max 12 chars)
            - multiSelect: bool
            - options: list of {label: str, description: str}

    Returns:
        artifact_id to use with wait_for_user_answer
    """
    artifact_id = str(uuid.uuid4())[:8]

    qa_sessions[artifact_id] = {
        "questions": questions,
        "answers": None,
        "event": asyncio.Event()
    }

    logger.info(f"Registered QA artifact: {artifact_id} with {len(questions)} questions")

    return {
        "artifact_id": artifact_id,
        "questions": questions
    }


@mcp.tool()
async def qa_get_questions(artifact_id: str) -> dict:
    """
    Get questions for a QA artifact (called by browser on load).

    Args:
        artifact_id: The artifact ID from qa_register

    Returns:
        The questions array for this artifact
    """
    if artifact_id not in qa_sessions:
        raise ValueError(f"Unknown artifact_id: {artifact_id}")

    session = qa_sessions[artifact_id]

    return {
        "artifact_id": artifact_id,
        "questions": session["questions"]
    }


@mcp.tool()
async def qa_submit(artifact_id: str, answers: dict) -> dict:
    """
    Submit answers for a QA artifact (called by browser).

    Args:
        artifact_id: The artifact ID from qa_register
        answers: Dict mapping question indices to selected answers

    Returns:
        Confirmation of submission
    """
    if artifact_id not in qa_sessions:
        raise ValueError(f"Unknown artifact_id: {artifact_id}")

    session = qa_sessions[artifact_id]

    if session["answers"] is not None:
        raise ValueError(f"Answers already submitted for artifact: {artifact_id}")

    session["answers"] = answers
    session["event"].set()

    logger.info(f"Received answers for artifact: {artifact_id}")

    return {
        "status": "submitted",
        "artifact_id": artifact_id
    }


@mcp.tool()
async def wait_for_user_answer(artifact_id: str, timeout_seconds: float = 300.0) -> dict:
    """
    Wait for user to submit answers (called by assistant).
    Blocks until qa_submit is called with answers.

    Args:
        artifact_id: The artifact ID from qa_register
        timeout_seconds: Max time to wait (default 5 minutes)

    Returns:
        The submitted answers
    """
    if artifact_id not in qa_sessions:
        raise ValueError(f"Unknown artifact_id: {artifact_id}")

    session = qa_sessions[artifact_id]

    if session["answers"] is not None:
        return {
            "artifact_id": artifact_id,
            "answers": session["answers"]
        }

    logger.info(f"Waiting for answers on artifact: {artifact_id}")

    try:
        await asyncio.wait_for(session["event"].wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Timeout waiting for answers on artifact: {artifact_id}")

    return {
        "artifact_id": artifact_id,
        "answers": session["answers"]
    }


if __name__ == "__main__":
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["mcp-protocol-version", "mcp-session-id", "Authorization", "Content-Type"],
            expose_headers=["mcp-session-id"],
        )
    ]
    app = mcp.http_app(middleware=middleware)
    uvicorn.run(app, host="0.0.0.0", port=3000)
