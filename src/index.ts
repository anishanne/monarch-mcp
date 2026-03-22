import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createGraphQLClient } from "./graphql/client.js";
import { createAPI } from "./sdk/index.js";
import { createServer } from "./server.js";
import { SimpleOAuthProvider } from "./auth.js";
import { connectDB } from "./db.js";
import {
  initLogger,
  setRequestId,
  setMode,
  log,
  getLogs,
  getRequestStats,
} from "./logger.js";
import { initTokenManager } from "./token-manager.js";
import { createRawServer } from "./raw-server.js";
import { renderDashboard } from "./dashboard.js";
import {
  getPendingRequests,
  approveRequest,
  denyRequest,
} from "./deletion-requests.js";

const PORT = parseInt(process.env.PORT || "8787", 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error("Missing MCP_AUTH_TOKEN");
  process.exit(1);
}

if (!process.env.MONARCH_TOKEN && !process.env.MONARCH_EMAIL) {
  console.warn(
    "Neither MONARCH_TOKEN nor MONARCH_EMAIL is set — Monarch API calls will fail until configured."
  );
}

// Connect to MongoDB, init logger indexes, load token
const dbReady = connectDB().then(() =>
  Promise.all([initLogger(), initTokenManager()])
);

const provider = new SimpleOAuthProvider(AUTH_TOKEN);

const app = express();

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[${req.method}] ${req.url} → ${res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// OAuth endpoints
const baseUrl = process.env.BASE_URL
  ? new URL(process.env.BASE_URL)
  : new URL(`http://localhost:${PORT}`);

app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: baseUrl,
    baseUrl,
  })
);

// /approve endpoint — validates password, issues auth code
app.post("/approve", express.json(), (req, res) => {
  const { clientId, redirectUri, codeChallenge, state, token } = req.body;

  if (token !== AUTH_TOKEN) {
    log({
      type: "auth",
      severity: "critical",
      method: "approve",
      summary: "Auth code request REJECTED: invalid token",
      details: { clientId: clientId?.slice(0, 20) + "...", redirectUri },
    });
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const code = provider.generateAuthorizationCode(
    clientId,
    codeChallenge,
    redirectUri
  );

  log({
    type: "auth",
    severity: "info",
    method: "approve",
    summary: "Auth code issued",
    details: { redirectUri },
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.json({ redirectUrl: redirectUrl.toString() });
});

// MCP endpoint (bearer-auth protected)
const bearerAuth = requireBearerAuth({ verifier: provider });

app.post("/mcp", bearerAuth, async (req, res) => {
  await dbReady;
  const requestId = crypto.randomUUID();
  setRequestId(requestId);
  setMode("code");

  log({
    type: "auth",
    severity: "info",
    method: "mcp",
    summary: `MCP code-mode request authenticated (${requestId.slice(0, 8)})`,
  });

  const client = createGraphQLClient();
  const api = createAPI(client);
  const mcpServer = createServer(api);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);

  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });
});

// Raw MCP endpoint — individual tools per SDK method
app.post("/mcp/raw", bearerAuth, async (req, res) => {
  await dbReady;
  const requestId = crypto.randomUUID();
  setRequestId(requestId);
  setMode("raw");

  log({
    type: "auth",
    severity: "info",
    method: "mcp/raw",
    summary: `MCP raw-mode request authenticated (${requestId.slice(0, 8)})`,
  });

  const client = createGraphQLClient();
  const api = createAPI(client);
  const mcpServer = createRawServer(api);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);

  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });
});

// GET and DELETE not supported in stateless mode
app.get("/mcp", bearerAuth, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST for stateless mode.",
    },
    id: null,
  });
});

app.delete("/mcp", bearerAuth, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST for stateless mode.",
    },
    id: null,
  });
});

app.get("/mcp/raw", bearerAuth, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST for stateless mode." },
    id: null,
  });
});

app.delete("/mcp/raw", bearerAuth, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST for stateless mode." },
    id: null,
  });
});

// Dashboard token check middleware
function requireDashboardAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.query.token as string;
  if (token !== AUTH_TOKEN) {
    res.status(401).send("Unauthorized. Append ?token=YOUR_MCP_AUTH_TOKEN");
    return;
  }
  next();
}

// Dashboard HTML
app.get("/dashboard", requireDashboardAuth, async (req, res) => {
  await dbReady;

  const query = {
    type: (req.query.type as string) ?? "",
    severity: (req.query.severity as string) ?? "",
    mode: (req.query.mode as string) ?? "",
    hours: (req.query.hours as string) ?? "24",
    limit: (req.query.limit as string) ?? "100",
    offset: (req.query.offset as string) ?? "0",
    requestId: (req.query.requestId as string) ?? "",
  };

  const [{ logs, total }, stats, deletionRequests] = await Promise.all([
    getLogs({
      type: query.type || undefined,
      severity: query.severity || undefined,
      mode: query.mode || undefined,
      limit: parseInt(query.limit),
      offset: parseInt(query.offset),
      requestId: query.requestId || undefined,
    }),
    getRequestStats(parseInt(query.hours) || 24),
    getPendingRequests(),
  ]);

  res.setHeader("Content-Type", "text/html");
  res.send(
    renderDashboard(logs, total, query, AUTH_TOKEN!, stats, deletionRequests)
  );
});

// Dashboard JSON API
app.get("/api/logs", requireDashboardAuth, async (req, res) => {
  await dbReady;
  const result = await getLogs({
    type: (req.query.type as string) || undefined,
    severity: (req.query.severity as string) || undefined,
    mode: (req.query.mode as string) || undefined,
    limit: parseInt((req.query.limit as string) ?? "100"),
    offset: parseInt((req.query.offset as string) ?? "0"),
    startDate: (req.query.startDate as string) || undefined,
    endDate: (req.query.endDate as string) || undefined,
    requestId: (req.query.requestId as string) || undefined,
  });
  res.json(result);
});

// Deletion request API
app.get("/api/deletion-requests", requireDashboardAuth, async (_req, res) => {
  await dbReady;
  const requests = await getPendingRequests();
  res.json(requests);
});

app.post(
  "/api/deletion-requests/:id/approve",
  requireDashboardAuth,
  express.json(),
  async (req, res) => {
    await dbReady;
    const ok = await approveRequest(req.params.id as string);
    res.json({ success: ok });
  }
);

app.post(
  "/api/deletion-requests/:id/deny",
  requireDashboardAuth,
  express.json(),
  async (req, res) => {
    await dbReady;
    const ok = await denyRequest(req.params.id as string);
    res.json({ success: ok });
  }
);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "monarch-mcp", mcp: "/mcp" });
});

// Export for Vercel, listen for local dev
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MCP server listening on http://localhost:${PORT}/mcp`);
    console.log(`Dashboard at http://localhost:${PORT}/dashboard?token=YOUR_TOKEN`);
    console.log(
      `OAuth metadata at http://localhost:${PORT}/.well-known/oauth-authorization-server`
    );
  });
}

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
