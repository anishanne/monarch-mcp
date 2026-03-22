import { MongoClient, type Collection, type Db } from "mongodb";

export type LogType =
  | "auth"
  | "tool_call"
  | "sdk_call"
  | "graphql"
  | "error"
  | "disabled";
export type Severity = "info" | "warning" | "critical";

export interface AuditLog {
  timestamp: Date;
  type: LogType;
  severity: Severity;
  method: string;
  summary: string;
  details?: any;
  durationMs?: number;
  requestId: string;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let collection: Collection<AuditLog> | null = null;

// Per-request context
let _requestId = "unknown";

export function setRequestId(id: string) {
  _requestId = id;
}

export function getRequestId(): string {
  return _requestId;
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set — audit logging disabled");
    return;
  }
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("monarch_mcp");
    collection = db.collection<AuditLog>("audit_logs");
    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ type: 1 });
    await collection.createIndex({ severity: 1 });
    await collection.createIndex({ requestId: 1 });
    console.log("MongoDB connected — audit logging enabled");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
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

export function log(entry: Omit<AuditLog, "timestamp" | "requestId">): void {
  const doc: AuditLog = {
    ...entry,
    timestamp: new Date(),
    requestId: _requestId,
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
    collection.insertOne(doc).catch(() => {});
  }
}

export interface LogQuery {
  type?: string;
  severity?: string;
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
