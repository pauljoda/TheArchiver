import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getPluginForUrl } from "@/plugins/registry";
import { getNextRunDate } from "@/lib/cron";
import { emitSSEEvent } from "@/lib/events";
import { processNow } from "@/workers/download.worker";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const db = getDb();
    const schedule = db
      .select()
      .from(schema.scheduledUrls)
      .where(eq(schema.scheduledUrls.id, scheduleId))
      .get();

    if (!schedule) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pluginName = getPluginForUrl(schedule.url)?.plugin.name ?? null;

    const result = db
      .insert(schema.downloadQueue)
      .values({ url: schedule.url, pluginName })
      .returning()
      .get();

    processNow();

    emitSSEEvent({
      type: "job:added",
      data: { id: result.id, url: schedule.url, pluginName },
    });

    const now = new Date();
    const nextRun = getNextRunDate(schedule.cronExpression);

    db.update(schema.scheduledUrls)
      .set({ lastRunAt: now, nextRunAt: nextRun, updatedAt: now })
      .where(eq(schema.scheduledUrls.id, scheduleId))
      .run();

    emitSSEEvent({ type: "schedule:changed", data: { id: scheduleId } });

    return NextResponse.json({
      message: `Queued "${schedule.label}" for immediate download`,
      queueId: result.id,
    });
  } catch (err) {
    console.error("Failed to run schedule:", err);
    return NextResponse.json(
      { error: "Failed to run schedule" },
      { status: 500 }
    );
  }
}
