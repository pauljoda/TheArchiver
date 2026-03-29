import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { inArray } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const items = db
      .select()
      .from(schema.downloadQueue)
      .where(
        inArray(schema.downloadQueue.status, ["pending", "processing"])
      )
      .all();

    return NextResponse.json(items);
  } catch (err) {
    console.error("Error fetching queue:", err);
    return NextResponse.json([], { status: 500 });
  }
}
