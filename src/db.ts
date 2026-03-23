import { MongoClient, type Db, type Collection, type Document } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectPromise: Promise<void> | null = null;

export async function connectDB(): Promise<void> {
  if (db) return;
  if (connectPromise) return connectPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set — database features disabled");
    return;
  }

  connectPromise = (async () => {
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
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export function getDB(): Db | null {
  return db;
}

export function getCollection<T extends Document>(
  name: string
): Collection<T> | null {
  return db ? db.collection<T>(name) : null;
}

/**
 * Ensures DB is connected, then returns the collection.
 * Use this instead of getCollection() when you need guaranteed connectivity.
 */
export async function ensureCollection<T extends Document>(
  name: string
): Promise<Collection<T> | null> {
  await connectDB();
  return db ? db.collection<T>(name) : null;
}
