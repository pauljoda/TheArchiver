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

// Singleton for the database connection
let _db: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDatabase();
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
