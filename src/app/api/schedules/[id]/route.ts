import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getNextRunDate, validateCron } from "@/lib/cron";
import { emitSSEEvent } from "@/lib/events";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .select()
      .from(schema.scheduledUrls)
      .where(eq(schema.scheduledUrls.id, scheduleId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.label !== undefined) updates.label = body.label.trim();
    if (body.url !== undefined) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
      updates.url = body.url.trim();
    }

    if (body.cronExpression !== undefined) {
      const validation = validateCron(body.cronExpression);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid cron expression: ${validation.error}` },
          { status: 400 }
        );
      }
      updates.cronExpression = body.cronExpression.trim();
      updates.nextRunAt = getNextRunDate(body.cronExpression);
    }

    if (body.enabled !== undefined) {
      updates.enabled = body.enabled;
      // When re-enabling, recompute nextRunAt so it doesn't fire for a stale time
      if (body.enabled && !existing.enabled) {
        const cron = (updates.cronExpression as string) ?? existing.cronExpression;
        updates.nextRunAt = getNextRunDate(cron);
      }
    }

    db.update(schema.scheduledUrls)
      .set(updates)
      .where(eq(schema.scheduledUrls.id, scheduleId))
      .run();

    emitSSEEvent({ type: "schedule:changed", data: { id: scheduleId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update schedule:", err);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = getDb();
    db.delete(schema.scheduledUrls)
      .where(eq(schema.scheduledUrls.id, scheduleId))
      .run();

    emitSSEEvent({ type: "schedule:changed", data: { id: scheduleId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete schedule:", err);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
