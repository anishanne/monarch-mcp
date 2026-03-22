import { MongoClient, type Collection, type Db } from "mongodb";

export type LogType =
  | "auth"
  | "token"
  | "tool_call"
  | "sdk_call"
  | "graphql"
  | "error"
  | "disabled";
export type Severity = "info" | "action" | "warning" | "critical";

export type Mode = "code" | "raw";

export interface AuditLog {
  timestamp: Date;
  type: LogType;
  severity: Severity;
  method: string;
  summary: string;
  details?: any;
  durationMs?: number;
  requestId: string;
  mode?: Mode;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let collection: Collection<AuditLog> | null = null;

// Per-request context
let _requestId = "unknown";
let _mode: Mode = "code";

export function setRequestId(id: string) {
  _requestId = id;
}

export function getRequestId(): string {
  return _requestId;
}

export function setMode(mode: Mode) {
  _mode = mode;
}

export function getMode(): Mode {
  return _mode;
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set — audit logging disabled");
    return;
  }
  console.log("Connecting to MongoDB...");
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("monarch_mcp");
    collection = db.collection<AuditLog>("audit_logs");
    // Create indexes in background — don't block startup
    collection.createIndex({ timestamp: -1 }).catch(() => {});
    collection.createIndex({ type: 1 }).catch(() => {});
    collection.createIndex({ severity: 1 }).catch(() => {});
    collection.createIndex({ requestId: 1 }).catch(() => {});
    collection.createIndex({ mode: 1 }).catch(() => {});
    console.log("MongoDB connected — audit logging enabled");
  } catch (err: any) {
    console.error("MongoDB connection failed:", err.message ?? err);
    client = null;
    db = null;
    collection = null;
  }
}

const WRITE_METHODS =
  /\b(create|update|split|set|refresh|updateItem)\b/i;
const DELETE_METHODS = /\b(delete)\b/i;

export function getSeverity(method: string, type?: LogType): Severity {
  if (type === "disabled" || type === "error") return "critical";
  if (DELETE_METHODS.test(method)) return "critical";
  if (WRITE_METHODS.test(method)) return "warning";
  return "info";
}

export function log(entry: Omit<AuditLog, "timestamp" | "requestId" | "mode">): void {
  const doc: AuditLog = {
    ...entry,
    timestamp: new Date(),
    requestId: _requestId,
    mode: _mode,
  };

  // Always console log
  const prefix =
    doc.severity === "critical"
      ? "🔴"
      : doc.severity === "warning"
        ? "🟡"
        : doc.severity === "action"
          ? "🔵"
          : "🟢";
  console.log(`${prefix} [${doc.type}] ${doc.summary}`);

  // Fire-and-forget to MongoDB
  if (collection) {
    collection.insertOne(doc).catch((err) => {
      console.error("Failed to write audit log:", err.message);
    });
  } else {
    console.warn("⚠️  Audit log skipped — MongoDB not connected");
  }
}

export interface LogQuery {
  type?: string;
  severity?: string;
  mode?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  requestId?: string;
}

export interface RequestStats {
  mcpRequests: number;
  monarchRequests: number;
  tokenRefreshes: number;
  hours: number;
  buckets: Array<{ label: string; mcp: number; monarch: number }>;
}

export async function getRequestStats(hours: number = 24): Promise<RequestStats> {
  if (!collection)
    return { mcpRequests: 0, monarchRequests: 0, tokenRefreshes: 0, hours, buckets: [] };

  const now = new Date();
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const timeFilter = { $gte: since };

  // Bucket size: <=6h → 15min, <=24h → 1h, <=72h → 3h, <=168h → 6h, else 24h
  let bucketMinutes: number;
  let dateFormat: string;
  if (hours <= 6) {
    bucketMinutes = 15;
    dateFormat = "%Y-%m-%dT%H:%M";
  } else if (hours <= 24) {
    bucketMinutes = 60;
    dateFormat = "%Y-%m-%dT%H:00";
  } else if (hours <= 72) {
    bucketMinutes = 180;
    dateFormat = "%Y-%m-%dT%H:00";
  } else if (hours <= 168) {
    bucketMinutes = 360;
    dateFormat = "%Y-%m-%dT%H:00";
  } else {
    bucketMinutes = 1440;
    dateFormat = "%Y-%m-%d";
  }

  const [mcpRequests, monarchRequests, tokenRefreshes, mcpBuckets, monarchBuckets] =
    await Promise.all([
      collection.countDocuments({
        type: "auth",
        method: { $in: ["mcp", "mcp/raw"] },
        timestamp: timeFilter,
      }),
      collection.countDocuments({
        type: "graphql",
        timestamp: timeFilter,
      }),
      collection.countDocuments({
        type: "token",
        method: "login",
        timestamp: timeFilter,
      }),
      // MCP requests by bucket
      collection
        .aggregate([
          {
            $match: {
              type: "auth",
              method: { $in: ["mcp", "mcp/raw"] },
              timestamp: timeFilter,
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: "$timestamp" } },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      // Monarch API calls by bucket
      collection
        .aggregate([
          {
            $match: { type: "graphql", timestamp: timeFilter },
          },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: "$timestamp" } },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

  // Build bucket map
  const bucketCount = Math.ceil((hours * 60) / bucketMinutes);
  const bucketMap = new Map<string, { mcp: number; monarch: number }>();
  for (let i = bucketCount - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * bucketMinutes * 60 * 1000);
    // Snap to bucket boundary
    if (bucketMinutes >= 1440) {
      const key = t.toISOString().slice(0, 10);
      bucketMap.set(key, { mcp: 0, monarch: 0 });
    } else {
      const mins = t.getMinutes();
      const snapped = new Date(t);
      snapped.setMinutes(Math.floor(mins / bucketMinutes) * bucketMinutes, 0, 0);
      const key =
        bucketMinutes < 60
          ? snapped.toISOString().slice(0, 16)
          : snapped.toISOString().slice(0, 13) + ":00";
      bucketMap.set(key, { mcp: 0, monarch: 0 });
    }
  }

  for (const row of mcpBuckets) {
    const entry = bucketMap.get(row._id);
    if (entry) entry.mcp += row.count;
  }
  for (const row of monarchBuckets) {
    const entry = bucketMap.get(row._id);
    if (entry) entry.monarch += row.count;
  }

  // Format labels
  const buckets = [...bucketMap.entries()].map(([key, counts]) => {
    let label: string;
    if (bucketMinutes >= 1440) {
      label = key.slice(5); // MM-DD
    } else {
      label = key.slice(11, 16); // HH:MM
    }
    return { label, ...counts };
  });

  return { mcpRequests, monarchRequests, tokenRefreshes, hours, buckets };
}

export async function getLogs(query: LogQuery): Promise<{
  logs: AuditLog[];
  total: number;
}> {
  if (!collection) return { logs: [], total: 0 };

  const filter: Record<string, any> = {};
  if (query.type) filter.type = query.type;
  if (query.severity) filter.severity = query.severity;
  if (query.mode) filter.mode = query.mode;
  if (query.requestId) filter.requestId = query.requestId;
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
    if (query.endDate) filter.timestamp.$lte = new Date(query.endDate);
  }

  const limit = Math.min(query.limit ?? 100, 500);
  const offset = query.offset ?? 0;

  const [logs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return { logs, total };
}
