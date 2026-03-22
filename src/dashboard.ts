import type { AuditLog, RequestStats } from "./logger.js";
import type { DeletionRequest } from "./deletion-requests.js";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: "#052e16", text: "#22c55e", border: "#166534" },
  action: { bg: "#0c1a3d", text: "#60a5fa", border: "#1e3a5f" },
  warning: { bg: "#422006", text: "#eab308", border: "#854d0e" },
  critical: { bg: "#450a0a", text: "#ef4444", border: "#991b1b" },
};

const TYPE_LABELS: Record<string, string> = {
  auth: "AUTH",
  token: "TOKEN",
  tool_call: "TOOL",
  sdk_call: "SDK",
  graphql: "GQL",
  error: "ERR",
  disabled: "BLOCK",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let _collapseId = 0;

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) return `<span class="dt-null">null</span>`;
  if (typeof value === "boolean") return `<span class="dt-bool">${value}</span>`;
  if (typeof value === "number") return `<span class="dt-num">${value}</span>`;

  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  // Code blocks — detect by key name or multi-line JS
  if (key === "code" || (typeof value === "string" && value.includes("await api."))) {
    return `<div class="dt-code">${escapeHtml(str.trim())}</div>`;
  }

  // Large objects (response data, errors) — collapsible
  if (key === "response" || key === "errors") {
    const formatted = escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    const id = `collapse-${_collapseId++}`;
    const sizeLabel = str.length > 1024 ? `${(str.length / 1024).toFixed(1)}KB` : `${str.length}b`;
    return `<div class="dt-collapse">
      <button class="dt-collapse-btn" onclick="document.getElementById('${id}').classList.toggle('open')">${key} (${sizeLabel}) ▸</button>
      <div class="dt-collapse-body" id="${id}"><pre class="dt-response">${formatted}</pre></div>
    </div>`;
  }

  // Short strings inline
  if (typeof value === "string" && str.length < 120) {
    return `<span class="dt-str">"${escapeHtml(str)}"</span>`;
  }

  // Medium objects — show inline
  if (typeof value === "object") {
    const formatted = escapeHtml(JSON.stringify(value, null, 2));
    if (formatted.length > 500) {
      const id = `collapse-${_collapseId++}`;
      return `<div class="dt-collapse">
        <button class="dt-collapse-btn" onclick="document.getElementById('${id}').classList.toggle('open')">${key} ▸</button>
        <div class="dt-collapse-body" id="${id}"><pre class="dt-response">${formatted}</pre></div>
      </div>`;
    }
    return `<span class="dt-str">${formatted}</span>`;
  }

  return `<span class="dt-str">"${escapeHtml(str)}"</span>`;
}

function formatDetails(details: any): string {
  if (!details) return "";
  if (typeof details !== "object") return escapeHtml(String(details));

  const rows = Object.entries(details).map(([key, value]) => {
    return `<div class="dt-row"><span class="dt-key">${escapeHtml(key)}</span>${formatValue(key, value)}</div>`;
  });
  return rows.join("");
}

const TIMESCALES = [
  { hours: 1, label: "1h" },
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" },
];

function renderStats(stats: RequestStats, token: string, currentQuery: Record<string, string>): string {
  const maxVal = Math.max(1, ...stats.buckets.map((b) => b.mcp + b.monarch));
  const barHeight = 40;
  const periodLabel = TIMESCALES.find((t) => t.hours === stats.hours)?.label ?? `${stats.hours}h`;

  // Show every Nth label to avoid crowding
  const labelEvery = stats.buckets.length > 24 ? Math.ceil(stats.buckets.length / 12) : 1;

  const bars = stats.buckets
    .map((b, i) => {
      const mcpH = Math.round((b.mcp / maxVal) * barHeight);
      const monarchH = Math.round((b.monarch / maxVal) * barHeight);
      const title = `${b.label} — MCP: ${b.mcp}, Monarch: ${b.monarch}`;
      const showLabel = i % labelEvery === 0;
      return `<div class="bar-col" title="${title}">
  <div class="bar-stack">
    <div class="bar-seg bar-monarch" style="height:${monarchH}px"></div>
    <div class="bar-seg bar-mcp" style="height:${mcpH}px"></div>
  </div>
  <span class="bar-label">${showLabel ? b.label : ""}</span>
</div>`;
    })
    .join("");

  const timescaleButtons = TIMESCALES.map((t) => {
    const params = new URLSearchParams({ token });
    for (const [k, v] of Object.entries(currentQuery)) {
      if (v && k !== "hours") params.set(k, v);
    }
    params.set("hours", String(t.hours));
    const active = stats.hours === t.hours;
    return `<a href="/dashboard?${params.toString()}" class="ts-btn${active ? " ts-active" : ""}">${t.label}</a>`;
  }).join("");

  return `<div class="stats-panel">
  <div class="stats-counters">
    <div class="stat-card">
      <div class="stat-num">${stats.mcpRequests}</div>
      <div class="stat-label">MCP Requests <span class="stat-period">${periodLabel}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-num ${stats.monarchRequests > 500 ? "stat-warn" : ""}">${stats.monarchRequests}</div>
      <div class="stat-label">Monarch API Calls <span class="stat-period">${periodLabel}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-num ${stats.tokenRefreshes > 5 ? "stat-warn" : ""}">${stats.tokenRefreshes}</div>
      <div class="stat-label">Token Refreshes <span class="stat-period">${periodLabel}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${stats.mcpRequests > 0 ? (stats.monarchRequests / stats.mcpRequests).toFixed(1) : "0"}</div>
      <div class="stat-label">API Calls / Request</div>
    </div>
  </div>
  <div class="chart-container">
    <div class="chart-header">
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:#60a5fa"></span>MCP</span>
        <span><span class="legend-dot" style="background:#f97316"></span>Monarch</span>
      </div>
      <div class="ts-buttons">${timescaleButtons}</div>
    </div>
    <div class="chart-bars">${bars}</div>
  </div>
</div>`;
}

function renderDeletionBanner(
  requests: DeletionRequest[],
  token: string
): string {
  if (requests.length === 0) return "";

  const items = requests
    .map((r) => {
      const id = r._id?.toString() ?? "";
      const snap = r.transactionSnapshot ?? {};
      const merchant = snap.merchant?.name ?? "Unknown";
      const amount =
        snap.amount != null
          ? `$${Math.abs(snap.amount).toFixed(2)}`
          : "—";
      const date = snap.date ?? "—";
      const reason = r.reason
        ? escapeHtml(r.reason)
        : "No reason provided";
      const requested = new Date(r.requestedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return `<div class="del-item" id="del-${id}">
  <div class="del-summary" onclick="document.getElementById('del-detail-${id}').classList.toggle('open')">
    <span class="del-badge">DELETE REQUEST</span>
    <span class="del-merchant">${escapeHtml(merchant)}</span>
    <span class="del-amount">${amount}</span>
    <span class="del-date">${date}</span>
    <span class="del-time">requested ${requested}</span>
  </div>
  <div class="del-detail" id="del-detail-${id}">
    <div class="del-reason"><strong>Reason:</strong> ${reason}</div>
    <div class="del-snapshot"><strong>Transaction:</strong> <a href="https://app.monarch.com/transactions/${encodeURIComponent(snap.id ?? r.transactionId)}" target="_blank" class="del-link">View on Monarch</a></div>
    ${snap.category ? `<div class="del-snapshot"><strong>Category:</strong> ${escapeHtml(snap.category?.name ?? "—")}</div>` : ""}
    ${snap.account ? `<div class="del-snapshot"><strong>Account:</strong> ${escapeHtml(snap.account?.displayName ?? "—")}</div>` : ""}
    ${snap.notes ? `<div class="del-snapshot"><strong>Notes:</strong> ${escapeHtml(snap.notes)}</div>` : ""}
    <div class="del-actions">
      <button class="del-approve" onclick="handleDeletion('${id}', 'approve', '${token}')">Approve Deletion</button>
      <button class="del-deny" onclick="handleDeletion('${id}', 'deny', '${token}')">Deny (Unhide)</button>
    </div>
  </div>
</div>`;
    })
    .join("");

  return `<div class="del-banner">
  <div class="del-header">${requests.length} pending deletion request${requests.length > 1 ? "s" : ""}</div>
  ${items}
</div>`;
}

export function renderDashboard(
  logs: AuditLog[],
  total: number,
  query: Record<string, string>,
  token: string,
  stats: RequestStats,
  deletionRequests: DeletionRequest[] = []
): string {
  _collapseId = 0; // reset for consistent IDs across live refreshes
  const currentType = query.type ?? "";
  const currentSeverity = query.severity ?? "";
  const currentMode = query.mode ?? "";
  const limit = parseInt(query.limit ?? "100");
  const offset = parseInt(query.offset ?? "0");
  const currentRequestId = query.requestId ?? "";

  const rows = logs
    .map((log, i) => {
      const colors = SEVERITY_COLORS[log.severity] ?? SEVERITY_COLORS.info;
      const typeLabel = TYPE_LABELS[log.type] ?? log.type.toUpperCase();
      const time = new Date(log.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const duration = log.durationMs != null ? `${log.durationMs}ms` : "—";
      const hasDetails = log.details && Object.keys(log.details).length > 0;
      const modeLabel = log.mode === "raw" ? "RAW" : "CODE";
      const modeColor = log.mode === "raw" ? "color:#c084fc" : "color:#60a5fa";

      return `<tr class="log-row" ${hasDetails ? `onclick="toggleDetail(${i})" style="cursor:pointer"` : ""}>
  <td class="time">${time}</td>
  <td><span class="badge" style="background:${colors.bg};color:${colors.text};border:1px solid ${colors.border}">${escapeHtml(log.severity)}</span></td>
  <td><span class="type-badge">${escapeHtml(typeLabel)}</span></td>
  <td><span class="type-badge" style="${modeColor}">${modeLabel}</span></td>
  <td class="method">${escapeHtml(log.method)}</td>
  <td class="summary">${escapeHtml(log.summary)}</td>
  <td class="duration">${duration}</td>
  <td class="req-id"><a href="/dashboard?token=${token}&requestId=${log.requestId}" class="rid">${log.requestId.slice(0, 8)}</a></td>
</tr>
${hasDetails ? `<tr class="detail-row" id="detail-${i}" style="display:none"><td colspan="8"><div class="detail-box">${formatDetails(log.details)}</div></td></tr>` : ""}`;
    })
    .join("\n");

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const filterParams = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ token });
    const merged = { type: currentType, severity: currentSeverity, mode: currentMode, limit: String(limit), requestId: currentRequestId, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Monarch MCP — Audit Dashboard</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0a0a0a; color: #e5e5e5; font-size: 13px; }
.header { padding: 1.5rem 2rem; border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; }
.header h1 { font-size: 1.1rem; font-weight: 600; }
.header .count { color: #888; font-size: 0.85rem; }
.filters { padding: 1rem 2rem; border-bottom: 1px solid #1a1a1a; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.filters a, .filters span { padding: 0.3rem 0.7rem; border-radius: 4px; text-decoration: none; font-size: 0.8rem; }
.filters a { color: #888; border: 1px solid #333; }
.filters a:hover { color: #e5e5e5; border-color: #555; }
.filters a.active { color: #e5e5e5; background: #222; border-color: #555; }
.filters .sep { color: #333; margin: 0 0.25rem; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 0.6rem 1rem; color: #666; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1a1a1a; background: #0d0d0d; position: sticky; top: 0; }
td { padding: 0.5rem 1rem; border-bottom: 1px solid #111; vertical-align: top; }
.log-row:hover { background: #111; }
.badge { padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.type-badge { color: #666; font-size: 0.75rem; font-weight: 500; }
.time { color: #666; white-space: nowrap; font-size: 0.8rem; }
.method { color: #93c5fd; font-weight: 500; }
.summary { max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.duration { color: #666; text-align: right; white-space: nowrap; }
.req-id { }
.rid { color: #555; text-decoration: none; font-size: 0.75rem; }
.rid:hover { color: #93c5fd; }
.detail-box { background: #111; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; color: #a3a3a3; max-height: 400px; overflow-y: auto; }
.dt-row { margin-bottom: 0.5rem; }
.dt-key { color: #7c8594; margin-right: 0.5rem; }
.dt-key::after { content: ":"; }
.dt-str { color: #a3a3a3; white-space: pre-wrap; word-break: break-all; }
.dt-num { color: #fbbf24; }
.dt-bool { color: #60a5fa; }
.dt-null { color: #555; font-style: italic; }
.dt-code { background: #0d0d0d; border: 1px solid #222; border-radius: 4px; padding: 0.75rem; margin-top: 0.25rem; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; color: #e2e8f0; white-space: pre; overflow-x: auto; line-height: 1.5; }
.dt-collapse { margin-top: 0.25rem; }
.dt-collapse-btn { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 0.25rem 0.6rem; color: #888; font-size: 0.75rem; cursor: pointer; font-family: inherit; }
.dt-collapse-btn:hover { color: #e5e5e5; border-color: #555; }
.dt-collapse-body { display: none; margin-top: 0.25rem; }
.dt-collapse-body.open { display: block; }
.dt-response { background: #0d0d0d; border: 1px solid #222; border-radius: 4px; padding: 0.75rem; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; color: #a3a3a3; white-space: pre-wrap; word-break: break-all; max-height: 500px; overflow-y: auto; margin: 0; }
.pagination { padding: 1rem 2rem; display: flex; gap: 0.5rem; justify-content: center; border-top: 1px solid #1a1a1a; }
.pagination a { color: #888; text-decoration: none; padding: 0.4rem 0.8rem; border: 1px solid #333; border-radius: 4px; font-size: 0.8rem; }
.pagination a:hover { color: #e5e5e5; border-color: #555; }
.pagination .disabled { color: #333; border-color: #1a1a1a; pointer-events: none; }
.empty { padding: 3rem; text-align: center; color: #555; }
.live-controls { display: flex; align-items: center; gap: 0.5rem; }
.live-btn { background: #111; border: 1px solid #333; border-radius: 6px; padding: 0.3rem 0.75rem; color: #888; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-family: inherit; letter-spacing: 0.05em; }
.live-btn:hover { border-color: #555; }
.live-btn.live-on { border-color: #166534; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; flex-shrink: 0; }
.live-dot.on { background: #22c55e; box-shadow: 0 0 6px #22c55e; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.stats-panel { padding: 1.25rem 2rem; border-bottom: 1px solid #1a1a1a; display: flex; gap: 2rem; align-items: flex-end; }
.stats-counters { display: flex; gap: 1.5rem; flex-shrink: 0; }
.stat-card { background: #111; border: 1px solid #222; border-radius: 8px; padding: 0.75rem 1.25rem; min-width: 120px; }
.stat-num { font-size: 1.5rem; font-weight: 700; color: #e5e5e5; line-height: 1; }
.stat-num.stat-warn { color: #f97316; }
.stat-label { font-size: 0.7rem; color: #666; margin-top: 0.25rem; }
.stat-period { color: #444; }
.chart-container { flex: 1; min-width: 0; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
.chart-legend { font-size: 0.7rem; color: #666; display: flex; gap: 1rem; }
.ts-buttons { display: flex; gap: 3px; }
.ts-btn { padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.7rem; color: #666; text-decoration: none; border: 1px solid #222; }
.ts-btn:hover { color: #e5e5e5; border-color: #444; }
.ts-active { color: #e5e5e5; background: #222; border-color: #444; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 3px; vertical-align: middle; }
.chart-bars { display: flex; align-items: flex-end; gap: 2px; height: 50px; }
.bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 0; }
.bar-stack { display: flex; flex-direction: column-reverse; }
.bar-seg { width: 100%; min-height: 0; border-radius: 1px; }
.bar-mcp { background: #60a5fa; }
.bar-monarch { background: #f97316; }
.bar-label { font-size: 0.55rem; color: #444; margin-top: 2px; }
.del-banner { background: #1a0a0a; border-bottom: 2px solid #991b1b; padding: 1rem 2rem; }
.del-header { color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.del-item { background: #111; border: 1px solid #333; border-radius: 6px; margin-bottom: 0.5rem; overflow: hidden; }
.del-summary { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; cursor: pointer; font-size: 0.8rem; }
.del-summary:hover { background: #1a1a1a; }
.del-badge { background: #450a0a; color: #ef4444; border: 1px solid #991b1b; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; letter-spacing: 0.03em; }
.del-merchant { color: #e5e5e5; font-weight: 500; }
.del-amount { color: #fbbf24; }
.del-date { color: #666; }
.del-time { color: #444; margin-left: auto; font-size: 0.75rem; }
.del-detail { display: none; padding: 0.75rem 1rem; border-top: 1px solid #222; background: #0d0d0d; }
.del-detail.open { display: block; }
.del-reason { color: #a3a3a3; font-size: 0.8rem; margin-bottom: 0.5rem; }
.del-snapshot { color: #666; font-size: 0.75rem; margin-bottom: 0.25rem; }
.del-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.del-approve { background: #450a0a; color: #ef4444; border: 1px solid #991b1b; padding: 0.4rem 1rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit; }
.del-approve:hover { background: #991b1b; color: #fff; }
.del-deny { background: #111; color: #888; border: 1px solid #333; padding: 0.4rem 1rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-family: inherit; }
.del-deny:hover { color: #e5e5e5; border-color: #555; }
.del-link { color: #60a5fa; text-decoration: none; }
.del-link:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="header">
  <h1>Monarch MCP Audit Log</h1>
  <span class="count">${total} events${currentRequestId ? ` (request ${currentRequestId.slice(0, 8)}...)` : ""}</span>
  <div class="live-controls">
    <button id="live-toggle" class="live-btn live-on" onclick="toggleLive()">
      <span id="live-dot" class="live-dot on"></span>
      <span id="live-label">LIVE</span>
    </button>
  </div>
</div>

${renderDeletionBanner(deletionRequests, token)}

${renderStats(stats, token, query)}

<div class="filters">
  <span style="color:#555;font-size:0.75rem">TYPE:</span>
  <a href="/dashboard?${filterParams({ type: "", offset: "0" })}" class="${!currentType ? "active" : ""}">All</a>
  ${["auth", "token", "tool_call", "sdk_call", "graphql", "error", "disabled"]
    .map(
      (t) =>
        `<a href="/dashboard?${filterParams({ type: t, offset: "0" })}" class="${currentType === t ? "active" : ""}">${TYPE_LABELS[t]}</a>`
    )
    .join("")}
  <span class="sep">|</span>
  <span style="color:#555;font-size:0.75rem">MODE:</span>
  <a href="/dashboard?${filterParams({ mode: "", offset: "0" })}" class="${!currentMode ? "active" : ""}">All</a>
  <a href="/dashboard?${filterParams({ mode: "code", offset: "0" })}" class="${currentMode === "code" ? "active" : ""}" style="color:#60a5fa">Code</a>
  <a href="/dashboard?${filterParams({ mode: "raw", offset: "0" })}" class="${currentMode === "raw" ? "active" : ""}" style="color:#c084fc">Raw</a>
  <span class="sep">|</span>
  <span style="color:#555;font-size:0.75rem">SEVERITY:</span>
  <a href="/dashboard?${filterParams({ severity: "", offset: "0" })}" class="${!currentSeverity ? "active" : ""}">All</a>
  ${["info", "action", "warning", "critical"]
    .map((s) => {
      const c = SEVERITY_COLORS[s];
      return `<a href="/dashboard?${filterParams({ severity: s, offset: "0" })}" class="${currentSeverity === s ? "active" : ""}" style="color:${c.text}">${s}</a>`;
    })
    .join("")}
  <span class="sep">|</span>
  <span style="color:#555;font-size:0.75rem">QUICK:</span>
  <a href="/dashboard?${filterParams({ type: "auth", severity: "", offset: "0" })}" style="color:#60a5fa">MCP Requests</a>
  <a href="/dashboard?${filterParams({ type: "graphql", severity: "", offset: "0" })}" style="color:#f97316">Monarch API</a>
  <a href="/dashboard?${filterParams({ type: "token", severity: "", offset: "0" })}" style="color:#fbbf24">Token Events</a>
  ${currentRequestId ? `<span class="sep">|</span><a href="/dashboard?${filterParams({ requestId: "" })}">Clear request filter</a>` : ""}
</div>

<table>
<thead>
<tr>
  <th>Time</th>
  <th>Severity</th>
  <th>Type</th>
  <th>Mode</th>
  <th>Method</th>
  <th>Summary</th>
  <th style="text-align:right">Duration</th>
  <th>Request</th>
</tr>
</thead>
<tbody>
${rows || '<tr><td colspan="8" class="empty">No events found.</td></tr>'}
</tbody>
</table>

<div class="pagination">
  <a href="/dashboard?${filterParams({ offset: String(prevOffset) })}" class="${!hasPrev ? "disabled" : ""}">← Prev</a>
  <span style="color:#555;padding:0.4rem;font-size:0.8rem">${offset + 1}–${Math.min(offset + limit, total)} of ${total}</span>
  <a href="/dashboard?${filterParams({ offset: String(nextOffset) })}" class="${!hasNext ? "disabled" : ""}">Next →</a>
</div>

<script>
let live = true;
let refreshTimer = null;
const REFRESH_INTERVAL = 5000;

function toggleDetail(i) {
  const row = document.getElementById('detail-' + i);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

function toggleLive() {
  live = !live;
  const dot = document.getElementById('live-dot');
  const label = document.getElementById('live-label');
  const btn = document.getElementById('live-toggle');
  if (live) {
    dot.className = 'live-dot on';
    label.textContent = 'LIVE';
    btn.className = 'live-btn live-on';
    startRefresh();
  } else {
    dot.className = 'live-dot';
    label.textContent = 'PAUSED';
    btn.className = 'live-btn';
    stopRefresh();
  }
}

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(doRefresh, REFRESH_INTERVAL);
}

function stopRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

async function doRefresh() {
  if (!live) return;
  try {
    const res = await fetch(window.location.href, { headers: { 'Accept': 'text/html' } });
    if (!res.ok) return;
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remember which details are expanded
    const expanded = new Set();
    document.querySelectorAll('.detail-row').forEach(row => {
      if (row.style.display !== 'none') expanded.add(row.id);
    });

    // Update stats
    const newStats = doc.querySelector('.stats-panel');
    const oldStats = document.querySelector('.stats-panel');
    if (newStats && oldStats) oldStats.innerHTML = newStats.innerHTML;

    // Update count
    const newCount = doc.querySelector('.count');
    const oldCount = document.querySelector('.count');
    if (newCount && oldCount) oldCount.innerHTML = newCount.innerHTML;

    // Update table body
    const newBody = doc.querySelector('tbody');
    const oldBody = document.querySelector('tbody');
    if (newBody && oldBody) oldBody.innerHTML = newBody.innerHTML;

    // Update pagination
    const newPag = doc.querySelector('.pagination');
    const oldPag = document.querySelector('.pagination');
    if (newPag && oldPag) oldPag.innerHTML = newPag.innerHTML;

    // Restore expanded details
    expanded.forEach(id => {
      const row = document.getElementById(id);
      if (row) row.style.display = '';
    });
  } catch {}
}

async function handleDeletion(id, action, token) {
  const label = action === 'approve' ? 'DELETE this transaction permanently' : 'deny deletion and unhide';
  if (!confirm('Are you sure you want to ' + label + '?')) return;
  try {
    const res = await fetch('/api/deletion-requests/' + id + '/' + action + '?token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.success) {
      const el = document.getElementById('del-' + id);
      if (el) el.style.display = 'none';
    } else {
      alert('Action failed. Check logs.');
    }
  } catch {
    alert('Request failed.');
  }
}

// Start live on load
startRefresh();
</script>
</body>
</html>`;
}
