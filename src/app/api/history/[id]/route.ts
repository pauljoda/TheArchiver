import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);

  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb();

  const existing = db
    .select({ id: schema.downloadHistory.id })
    .from(schema.downloadHistory)
    .where(eq(schema.downloadHistory.id, numId))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(schema.downloadHistory)
    .where(eq(schema.downloadHistory.id, numId))
    .run();

  return NextResponse.json({ success: true });
}
