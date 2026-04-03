import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { emitSSEEvent } from "@/lib/events";

export async function DELETE() {
  const db = getDb();

  db.delete(schema.downloadQueue)
    .where(eq(schema.downloadQueue.status, "pending"))
    .run();

  emitSSEEvent({ type: "queue:cleared", data: {} });

  return NextResponse.json({ success: true });
}
