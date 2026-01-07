import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Israel timezone
const ISRAEL_TZ = "Asia/Jerusalem";

export class IsraelTimeMCP extends McpAgent {
  server = new McpServer({
    name: "Israel Time Server",
    version: "1.0.0",
  });

  async init() {
    // Tool: Get current Israel time
    this.server.tool(
      "get_israel_time",
      "Get the current time in Israel (Asia/Jerusalem timezone)",
      {},
      async () => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
          timeZone: ISRAEL_TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        };

        const formatter = new Intl.DateTimeFormat("en-IL", options);
        const parts = formatter.formatToParts(now);

        const getPart = (type: string) =>
          parts.find((p) => p.type === type)?.value || "";

        const time24h = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
        const date = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

        // Get 12-hour format
        const time12hFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: ISRAEL_TZ,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        const time12h = time12hFormatter.format(now);

        // Get day name
        const dayFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: ISRAEL_TZ,
          weekday: "long",
        });
        const day = dayFormatter.format(now);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  time: time24h,
                  time_12h: time12h,
                  date: date,
                  day: day,
                  timezone: ISRAEL_TZ,
                  iso: now.toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // Tool: Check if current time is before a specific hour
    this.server.tool(
      "is_before_hour",
      "Check if the current Israel time is before a specific hour (24h format). Useful for time-based rules like 'only do X before 18:00'.",
      {
        hour: z
          .number()
          .min(0)
          .max(23)
          .describe("Hour in 24-hour format (0-23)"),
      },
      async ({ hour }) => {
        const now = new Date();
        const israelHourFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: ISRAEL_TZ,
          hour: "numeric",
          hour12: false,
        });
        const currentHour = parseInt(israelHourFormatter.format(now), 10);

        const timeFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: ISRAEL_TZ,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const currentTime = timeFormatter.format(now);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  current_hour: currentHour,
                  target_hour: hour,
                  is_before: currentHour < hour,
                  current_time: currentTime,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return IsraelTimeMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return IsraelTimeMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Israel Time MCP Server. Connect via /sse or /mcp", {
      status: 200,
    });
  },
};
