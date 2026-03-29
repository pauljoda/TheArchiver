import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  db.delete(schema.downloadQueue)
    .where(eq(schema.downloadQueue.id, parseInt(id, 10)))
    .run();

  return NextResponse.json({ success: true });
}
