import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  db.delete(schema.downloadQueue)
    .where(
      and(
        eq(schema.downloadQueue.id, parseInt(id, 10)),
        eq(schema.downloadQueue.status, "failed")
      )
    )
    .run();

  return NextResponse.json({ success: true });
}
