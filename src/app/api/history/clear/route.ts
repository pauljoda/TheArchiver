import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { emitSSEEvent } from "@/lib/events";

export async function DELETE() {
  const db = getDb();

  db.delete(schema.downloadHistory).run();

  emitSSEEvent({ type: "history:cleared", data: {} });

  return NextResponse.json({ success: true });
}
