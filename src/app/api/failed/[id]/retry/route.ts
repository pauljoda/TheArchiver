import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { emitSSEEvent } from "@/lib/events";
import { processNow } from "@/workers/download.worker";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const itemId = parseInt(id, 10);

  // Find the failed item
  const item = db
    .select()
    .from(schema.downloadQueue)
    .where(
      and(
        eq(schema.downloadQueue.id, itemId),
        eq(schema.downloadQueue.status, "failed")
      )
    )
    .get();

  if (!item) {
    return NextResponse.json(
      { error: "Failed item not found" },
      { status: 404 }
    );
  }

  // Reset to pending
  db.update(schema.downloadQueue)
    .set({
      status: "pending",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    })
    .where(eq(schema.downloadQueue.id, itemId))
    .run();

  // Wake the worker
  processNow();

  emitSSEEvent({
    type: "job:added",
    data: { id: itemId, url: item.url },
  });

  return NextResponse.json({ success: true, id: itemId });
}
