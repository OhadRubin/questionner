import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DurableObject } from "cloudflare:workers";

// Durable Object for QA Session state
export class QASessionDO extends DurableObject<Env> {
  private questions: Array<{
    question: string;
    header: string;
    multiSelect: boolean;
    options: Array<{ label: string; description: string }>;
  }> | null = null;
  private answers: Record<string, string | string[]> | null = null;
  private waiters: Array<{ resolve: (value: unknown) => void; timeout: ReturnType<typeof setTimeout> }> = [];

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1); // Remove leading slash

    switch (action) {
      case "register": {
        const body = await request.json() as { questions: typeof this.questions };
        this.questions = body.questions;
        this.answers = null;
        await this.ctx.storage.put("questions", this.questions);
        await this.ctx.storage.delete("answers");
        return Response.json({ success: true });
      }

      case "get_questions": {
        const questions = await this.ctx.storage.get("questions") || this.questions;
        if (!questions) {
          return Response.json({ error: "Session not found" }, { status: 404 });
        }
        return Response.json({ questions });
      }

      case "submit": {
        const body = await request.json() as { answers: typeof this.answers };
        const existingAnswers = await this.ctx.storage.get("answers");
        if (existingAnswers) {
          return Response.json({ error: "Answers already submitted" }, { status: 400 });
        }
        this.answers = body.answers;
        await this.ctx.storage.put("answers", this.answers);

        // Resolve all waiters
        for (const waiter of this.waiters) {
          clearTimeout(waiter.timeout);
          waiter.resolve({ answers: this.answers });
        }
        this.waiters = [];

        return Response.json({ success: true });
      }

      case "wait": {
        // Check if answers already exist
        const existingAnswers = await this.ctx.storage.get("answers");
        if (existingAnswers) {
          return Response.json({ answers: existingAnswers });
        }

        const timeoutMs = parseInt(url.searchParams.get("timeout") || "300000", 10);

        // Long-poll: wait for answers
        return new Promise<Response>((resolve) => {
          const timeout = setTimeout(() => {
            const idx = this.waiters.findIndex(w => w.resolve === resolveWaiter);
            if (idx !== -1) this.waiters.splice(idx, 1);
            resolve(Response.json({ error: "Timeout waiting for answers" }, { status: 408 }));
          }, Math.min(timeoutMs, 300000)); // Max 5 minutes

          const resolveWaiter = (value: unknown) => {
            resolve(Response.json(value));
          };

          this.waiters.push({ resolve: resolveWaiter, timeout });
        });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  }
}

// Question schema for validation
const QuestionSchema = z.object({
  question: z.string().describe("The question text"),
  header: z.string().max(12).describe("Short label, max 12 chars"),
  multiSelect: z.boolean().describe("Allow multiple selections"),
  options: z.array(z.object({
    label: z.string().describe("Option label"),
    description: z.string().describe("Option description")
  })).min(2).max(4).describe("2-4 options")
});

export class QAFlowMCP extends McpAgent {
  server = new McpServer({
    name: "QA Flow Server",
    version: "1.0.0",
  });

  async init() {
    // Tool: Register a new QA session with questions
    this.server.tool(
      "qa_register",
      "Register a new QA artifact with questions. Returns artifact_id for subsequent calls.",
      {
        questions: z.array(QuestionSchema).min(1).max(4).describe("1-4 questions to present to user")
      },
      async ({ questions }) => {
        const artifactId = crypto.randomUUID().slice(0, 8);

        // Get Durable Object stub and register the session
        const id = this.env.QA_SESSION.idFromName(artifactId);
        const stub = this.env.QA_SESSION.get(id);

        await stub.fetch(new Request("http://internal/register", {
          method: "POST",
          body: JSON.stringify({ questions })
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              artifact_id: artifactId,
              questions: questions,
              message: `QA session registered. Present the artifact to the user, then call wait_for_user_answer with artifact_id="${artifactId}"`
            }, null, 2)
          }]
        };
      }
    );

    // Tool: Get questions for a QA artifact (called by browser)
    this.server.tool(
      "qa_get_questions",
      "Get questions for a QA artifact. Called by browser on page load.",
      {
        artifact_id: z.string().describe("The artifact ID from qa_register")
      },
      async ({ artifact_id }) => {
        const id = this.env.QA_SESSION.idFromName(artifact_id);
        const stub = this.env.QA_SESSION.get(id);

        const response = await stub.fetch(new Request("http://internal/get_questions"));
        const data = await response.json() as { questions?: unknown; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to get questions");
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              artifact_id: artifact_id,
              questions: data.questions
            }, null, 2)
          }]
        };
      }
    );

    // Tool: Submit answers (called by browser)
    this.server.tool(
      "qa_submit",
      "Submit answers for a QA artifact. Called by browser when user clicks Submit.",
      {
        artifact_id: z.string().describe("The artifact ID from qa_register"),
        answers: z.record(z.union([z.string(), z.array(z.string())])).describe("Answers keyed by question index (q0, q1, etc)")
      },
      async ({ artifact_id, answers }) => {
        const id = this.env.QA_SESSION.idFromName(artifact_id);
        const stub = this.env.QA_SESSION.get(id);

        const response = await stub.fetch(new Request("http://internal/submit", {
          method: "POST",
          body: JSON.stringify({ answers })
        }));

        const data = await response.json() as { success?: boolean; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit answers");
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "submitted",
              artifact_id: artifact_id
            }, null, 2)
          }]
        };
      }
    );

    // Tool: Wait for user to submit answers (called by assistant)
    this.server.tool(
      "wait_for_user_answer",
      "Wait for user to submit answers. BLOCKS until qa_submit is called. Default timeout 5 minutes.",
      {
        artifact_id: z.string().describe("The artifact ID from qa_register"),
        timeout_seconds: z.number().min(1).max(300).default(300).describe("Max wait time in seconds (default 300)")
      },
      async ({ artifact_id, timeout_seconds }) => {
        const id = this.env.QA_SESSION.idFromName(artifact_id);
        const stub = this.env.QA_SESSION.get(id);

        const timeoutMs = (timeout_seconds || 300) * 1000;
        const response = await stub.fetch(new Request(`http://internal/wait?timeout=${timeoutMs}`));

        const data = await response.json() as { answers?: unknown; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to wait for answers");
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              artifact_id: artifact_id,
              answers: data.answers
            }, null, 2)
          }]
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return QAFlowMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return QAFlowMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("QA Flow MCP Server. Connect via /sse or /mcp", {
      status: 200,
    });
  },
};
