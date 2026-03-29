import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const items = db
    .select()
    .from(schema.downloadQueue)
    .where(eq(schema.downloadQueue.status, "failed"))
    .all();

  return NextResponse.json(items);
}
