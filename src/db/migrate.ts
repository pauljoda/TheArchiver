import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const dbUrl = process.env.DATABASE_URL || "file:./data/archiver.db";
const dbPath = dbUrl.replace(/^file:/, "");
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: path.resolve("drizzle") });

console.log("Migrations complete.");
sqlite.close();
