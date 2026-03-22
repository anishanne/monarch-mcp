import { MongoClient, type Collection, type Db } from "mongodb";

export type LogType =
  | "auth"
  | "token"
  | "tool_call"
  | "sdk_call"
  | "graphql"
  | "error"
  | "disabled";
export type Severity = "info" | "warning" | "critical";

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
