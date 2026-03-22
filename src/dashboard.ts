import type { AuditLog } from "./logger.js";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: "#052e16", text: "#22c55e", border: "#166534" },
  warning: { bg: "#422006", text: "#eab308", border: "#854d0e" },
  critical: { bg: "#450a0a", text: "#ef4444", border: "#991b1b" },
};

const TYPE_LABELS: Record<string, string> = {
  auth: "AUTH",
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
    .replace(/"/g, "&quot;");
}

function formatDetails(details: any): string {
  if (!details) return "";
  try {
    return escapeHtml(JSON.stringify(details, null, 2));
  } catch {
    return escapeHtml(String(details));
  }
}

export function renderDashboard(
  logs: AuditLog[],
  total: number,
  query: Record<string, string>,
  token: string
): string {
  const currentType = query.type ?? "";
  const currentSeverity = query.severity ?? "";
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

      return `<tr class="log-row" ${hasDetails ? `onclick="toggleDetail(${i})" style="cursor:pointer"` : ""}>
  <td class="time">${time}</td>
  <td><span class="badge" style="background:${colors.bg};color:${colors.text};border:1px solid ${colors.border}">${escapeHtml(log.severity)}</span></td>
  <td><span class="type-badge">${escapeHtml(typeLabel)}</span></td>
  <td class="method">${escapeHtml(log.method)}</td>
  <td class="summary">${escapeHtml(log.summary)}</td>
  <td class="duration">${duration}</td>
  <td class="req-id"><a href="/dashboard?token=${token}&requestId=${log.requestId}" class="rid">${log.requestId.slice(0, 8)}</a></td>
</tr>
${hasDetails ? `<tr class="detail-row" id="detail-${i}" style="display:none"><td colspan="7"><pre class="detail-pre">${formatDetails(log.details)}</pre></td></tr>` : ""}`;
    })
    .join("\n");

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const filterParams = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ token });
    const merged = { type: currentType, severity: currentSeverity, limit: String(limit), requestId: currentRequestId, ...overrides };
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
.detail-pre { background: #111; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; color: #a3a3a3; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.pagination { padding: 1rem 2rem; display: flex; gap: 0.5rem; justify-content: center; border-top: 1px solid #1a1a1a; }
.pagination a { color: #888; text-decoration: none; padding: 0.4rem 0.8rem; border: 1px solid #333; border-radius: 4px; font-size: 0.8rem; }
.pagination a:hover { color: #e5e5e5; border-color: #555; }
.pagination .disabled { color: #333; border-color: #1a1a1a; pointer-events: none; }
.empty { padding: 3rem; text-align: center; color: #555; }
</style>
</head>
<body>
<div class="header">
  <h1>Monarch MCP Audit Log</h1>
  <span class="count">${total} events${currentRequestId ? ` (request ${currentRequestId.slice(0, 8)}...)` : ""}</span>
</div>

<div class="filters">
  <span style="color:#555;font-size:0.75rem">TYPE:</span>
  <a href="/dashboard?${filterParams({ type: "", offset: "0" })}" class="${!currentType ? "active" : ""}">All</a>
  ${["auth", "tool_call", "sdk_call", "graphql", "error", "disabled"]
    .map(
      (t) =>
        `<a href="/dashboard?${filterParams({ type: t, offset: "0" })}" class="${currentType === t ? "active" : ""}">${TYPE_LABELS[t]}</a>`
    )
    .join("")}
  <span class="sep">|</span>
  <span style="color:#555;font-size:0.75rem">SEVERITY:</span>
  <a href="/dashboard?${filterParams({ severity: "", offset: "0" })}" class="${!currentSeverity ? "active" : ""}">All</a>
  ${["info", "warning", "critical"]
    .map((s) => {
      const c = SEVERITY_COLORS[s];
      return `<a href="/dashboard?${filterParams({ severity: s, offset: "0" })}" class="${currentSeverity === s ? "active" : ""}" style="color:${c.text}">${s}</a>`;
    })
    .join("")}
  ${currentRequestId ? `<span class="sep">|</span><a href="/dashboard?${filterParams({ requestId: "" })}">Clear request filter</a>` : ""}
</div>

<table>
<thead>
<tr>
  <th>Time</th>
  <th>Severity</th>
  <th>Type</th>
  <th>Method</th>
  <th>Summary</th>
  <th style="text-align:right">Duration</th>
  <th>Request</th>
</tr>
</thead>
<tbody>
${rows || '<tr><td colspan="7" class="empty">No events found.</td></tr>'}
</tbody>
</table>

<div class="pagination">
  <a href="/dashboard?${filterParams({ offset: String(prevOffset) })}" class="${!hasPrev ? "disabled" : ""}">← Prev</a>
  <span style="color:#555;padding:0.4rem;font-size:0.8rem">${offset + 1}–${Math.min(offset + limit, total)} of ${total}</span>
  <a href="/dashboard?${filterParams({ offset: String(nextOffset) })}" class="${!hasNext ? "disabled" : ""}">Next →</a>
</div>

<script>
function toggleDetail(i) {
  const row = document.getElementById('detail-' + i);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}
</script>
</body>
</html>`;
}
