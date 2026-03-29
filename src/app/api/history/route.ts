import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const items = db
    .select()
    .from(schema.downloadHistory)
    .orderBy(desc(schema.downloadHistory.completedAt))
    .limit(100)
    .all();

  return NextResponse.json(items);
}
