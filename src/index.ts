import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { SCHEDULE_URL, formatDetail, formatLine, listFilters, loadSessions, search } from "./schedule";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

// One JSON line per call, so Workers Logs can count calls by tool. What people searched for is not logged.
const logCall = (tool: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event: "tool_call", tool, ...fields }));

function createServer() {
  const server = new McpServer(
    { name: "unofficial-kubecon-na-2026", version: "1.0.0" },
    {
      instructions:
        "Unofficial, read-only search over the public KubeCon + CloudNativeCon North America 2026 " +
        `schedule (Salt Lake City, Nov 9-12). Times are Salt Lake City local time. Official schedule: ${SCHEDULE_URL}`,
    },
  );

  server.registerTool(
    "search_sessions",
    {
      description:
        "Search KubeCon NA 2026 sessions. All filters are optional and combine with AND. " +
        "Returns one line per session: [id] day date start-end | room | track | title | speakers.",
      inputSchema: {
        query: z.string().optional().describe("Words that must all appear in title, abstract, track or tags"),
        speaker: z.string().optional().describe("Speaker name or company"),
        day: z.string().optional().describe("Weekday (mon, tue, wed, thu) or date (2026-11-10)"),
        after: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Starts at or after HH:MM local"),
        before: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Starts before HH:MM local"),
        room: z.string().optional().describe("Room name substring, e.g. 'Grand Ballroom H'"),
        track: z.string().optional().describe("Track or tag substring, e.g. 'Observability'"),
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async ({ limit, ...filters }) => {
      const hits = search(await loadSessions(), filters);
      const used = Object.entries(filters).filter(([, v]) => v !== undefined).map(([k]) => k);
      logCall("search_sessions", { filters: used, matches: hits.length });
      if (!hits.length) return text("No matching sessions.");
      const shown = hits.slice(0, limit).map(formatLine).join("\n");
      return text(`${Math.min(limit, hits.length)} of ${hits.length} matches:\n${shown}`);
    },
  );

  server.registerTool(
    "get_session",
    {
      description: "Full details of one session by id: abstract, speakers, room, time and level.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const s = (await loadSessions()).find((s) => s.id === id);
      logCall("get_session", { found: Boolean(s) });
      return text(s ? formatDetail(s) : `No session with id ${id}.`);
    },
  );

  server.registerTool(
    "list_filters",
    { description: "Valid days, rooms and tracks to use as search_sessions filters." },
    async () => {
      logCall("list_filters");
      return text(JSON.stringify(listFilters(await loadSessions()), null, 2));
    },
  );

  return server;
}

const mcp = createMcpHandler(createServer);

export default {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/") {
      return new Response(
        `Unofficial KubeCon NA 2026 schedule MCP server.\nMCP endpoint: ${new URL("/mcp", request.url)}\n` +
          `Official schedule: ${SCHEDULE_URL}\nSource: https://github.com/gengwg/kubecon-mcp\n`,
      );
    }
    return mcp(request, env, ctx);
  },
} satisfies ExportedHandler;
