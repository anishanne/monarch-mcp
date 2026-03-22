import { MongoClient, type Db, type Collection, type Document } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set — database features disabled");
    return;
  }
  console.log("Connecting to MongoDB...");
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("monarch_mcp");
    console.log("MongoDB connected");
  } catch (err: any) {
    console.error("MongoDB connection failed:", err.message ?? err);
    client = null;
    db = null;
  }
}

export function getDB(): Db | null {
  return db;
}

export function getCollection<T extends Document>(
  name: string
): Collection<T> | null {
  return db ? db.collection<T>(name) : null;
}
