import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const items = db
      .select()
      .from(schema.downloadHistory)
      .orderBy(desc(schema.downloadHistory.completedAt))
      .limit(100)
      .all();

    return NextResponse.json(items);
  } catch (err) {
    console.error("Error fetching history:", err);
    return NextResponse.json([], { status: 500 });
  }
}
