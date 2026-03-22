import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchSpec, getEnabledSpec } from "./spec/api-spec.js";
import { TYPE_DEFINITIONS } from "./spec/types.js";
import { executeCode } from "./executor.js";
import { log } from "./logger.js";
import type { MonarchAPI } from "./sdk/index.js";

function buildApiCategoryListing(): string {
  const enabled = getEnabledSpec();
  const categories = new Map<string, string[]>();
  for (const m of enabled) {
    const methodName = m.name.replace(`api.${m.category}.`, "");
    if (!categories.has(m.category)) categories.set(m.category, []);
    categories.get(m.category)!.push(methodName);
  }
  return [...categories.entries()]
    .map(([cat, methods]) => `- api.${cat} — ${methods.join(", ")}`)
    .join("\n");
}

export function createServer(api: MonarchAPI): McpServer {
  const server = new McpServer({
    name: "monarch-mcp",
    version: "1.0.0",
  });

  server.tool(
    "search",
    `Search the Monarch Money API for available methods. Returns matching method signatures, descriptions, and usage examples. Use this before writing code to find the right methods.`,
    {
      query: z
        .string()
        .describe(
          "Search query (e.g. 'accounts', 'transactions filter', 'budget', 'cashflow', 'holdings')"
        ),
    },
    async ({ query }) => {
      const start = Date.now();
      const results = searchSpec(query);

      log({
        type: "tool_call",
        severity: "info",
        method: "search",
        summary: `search: "${query}" → ${results.length} results (${Date.now() - start}ms)`,
        details: {
          query,
          resultCount: results.length,
          matchedMethods: results.map((m) => m.name),
        },
        durationMs: Date.now() - start,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No methods found for "${query}". Try broader terms like: accounts, transactions, budgets, cashflow, categories, tags, holdings, recurring, snapshots, subscription, institutions`,
            },
          ],
        };
      }

      const text = results
        .map(
          (m) =>
            `### ${m.name}${m.parameters}\n**Returns:** ${m.returns}\n${m.description}\n**Example:** \`${m.example}\``
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  const apiListing = buildApiCategoryListing();

  server.tool(
    "execute",
    `Execute JavaScript code against the Monarch Money API. The \`api\` object is pre-configured and authenticated.

Write async JavaScript that uses \`api\` methods and returns a result. The code runs in an async context — use \`await\` freely and \`return\` the final value.

## Available API categories:
${apiListing}

Use the \`search\` tool first to find specific method signatures.

${TYPE_DEFINITIONS}`,
    {
      code: z
        .string()
        .describe(
          "JavaScript code to execute. Use `await` for async calls and `return` the result."
        ),
    },
    async ({ code }) => {
      const start = Date.now();

      log({
        type: "tool_call",
        severity: "action",
        method: "execute",
        summary: `execute: ${code.length} chars of code`,
        details: { code },
      });

      const result = await executeCode(code, api);
      const durationMs = Date.now() - start;

      log({
        type: "tool_call",
        severity: "info",
        method: "execute.complete",
        summary: `execute: completed (${durationMs}ms, ${result.length} chars output)`,
        details: { outputSize: result.length },
        durationMs,
      });

      return {
        content: [{ type: "text" as const, text: result }],
      };
    }
  );

  return server;
}
