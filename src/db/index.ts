import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

function getDatabasePath(): string {
  const dbUrl = process.env.DATABASE_URL || "file:./data/archiver.db";
  // Strip "file:" prefix if present
  const dbPath = dbUrl.replace(/^file:/, "");
  return dbPath;
}

function createDatabase() {
  const dbPath = getDatabasePath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

// Use globalThis to ensure a single DB connection across all Next.js
// webpack bundles (API routes, instrumentation, worker, etc.)
// Without this, each webpack chunk gets its own _db variable and
// creates separate SQLite connections, causing stale reads.
interface DbGlobal {
  __archiverDb?: ReturnType<typeof createDatabase>;
}

const g = globalThis as unknown as DbGlobal;

export function getDb() {
  if (!g.__archiverDb) {
    g.__archiverDb = createDatabase();
  }
  return g.__archiverDb;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
