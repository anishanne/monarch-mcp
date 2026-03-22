import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createGraphQLClient } from "./graphql/client.js";
import { createAPI } from "./sdk/index.js";
import { createServer } from "./server.js";
import { SimpleOAuthProvider } from "./auth.js";

const PORT = parseInt(process.env.PORT || "8787", 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const MONARCH_TOKEN = process.env.MONARCH_TOKEN;

if (!AUTH_TOKEN) {
  console.error("Missing MCP_AUTH_TOKEN");
  process.exit(1);
}

if (!MONARCH_TOKEN) {
  console.error("Missing MONARCH_TOKEN");
  process.exit(1);
}

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
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const code = provider.generateAuthorizationCode(
    clientId,
    codeChallenge,
    redirectUri
  );

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.json({ redirectUrl: redirectUrl.toString() });
});

// MCP endpoint (bearer-auth protected)
const bearerAuth = requireBearerAuth({ verifier: provider });

app.post("/mcp", bearerAuth, async (req, res) => {
  const client = createGraphQLClient(MONARCH_TOKEN!);
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

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "monarch-mcp", mcp: "/mcp" });
});

// Export for Vercel, listen for local dev
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MCP server listening on http://localhost:${PORT}/mcp`);
    console.log(
      `OAuth metadata at http://localhost:${PORT}/.well-known/oauth-authorization-server`
    );
  });
}

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
