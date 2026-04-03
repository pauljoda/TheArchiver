import { getDb, schema } from "@/db";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { getPluginForUrl } from "@/plugins/registry";
import { emitSSEEvent } from "@/lib/events";
import { getNextRunDate } from "@/lib/cron";
import { processNow } from "@/workers/download.worker";

const SCHEDULE_POLL_MS = 60_000;

let started = false;
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();

    const due = db
      .select()
      .from(schema.scheduledUrls)
      .where(
        and(
          eq(schema.scheduledUrls.enabled, true),
          isNotNull(schema.scheduledUrls.nextRunAt),
          lte(schema.scheduledUrls.nextRunAt, now)
        )
      )
      .all();

    for (const schedule of due) {
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

      const nextRun = getNextRunDate(schedule.cronExpression);

      db.update(schema.scheduledUrls)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun,
          updatedAt: now,
        })
        .where(eq(schema.scheduledUrls.id, schedule.id))
        .run();

      console.log(
        `[Scheduler] Queued "${schedule.label}" (${schedule.url}), next run: ${nextRun?.toISOString() ?? "unknown"}`
      );
    }

    if (due.length > 0) {
      emitSSEEvent({ type: "schedule:changed", data: {} });
    }
  } catch (err) {
    console.error("[Scheduler] Tick error:", err);
  }
}

function scheduleLoop(): void {
  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(() => {
    tick().finally(() => {
      if (started) scheduleLoop();
    });
  }, SCHEDULE_POLL_MS);
}

export async function startScheduler(): Promise<void> {
  if (started) return;
  started = true;

  // Recompute nextRunAt for any enabled schedule with a null nextRunAt
  const db = getDb();
  const broken = db
    .select()
    .from(schema.scheduledUrls)
    .where(
      and(
        eq(schema.scheduledUrls.enabled, true),
        // nextRunAt is null — needs recompute
      )
    )
    .all()
    .filter((s) => s.nextRunAt === null);

  for (const schedule of broken) {
    const nextRun = getNextRunDate(schedule.cronExpression);
    if (nextRun) {
      db.update(schema.scheduledUrls)
        .set({ nextRunAt: nextRun, updatedAt: new Date() })
        .where(eq(schema.scheduledUrls.id, schedule.id))
        .run();
    }
  }

  console.log(`Schedule worker started (polling every ${SCHEDULE_POLL_MS / 1000}s)`);
  scheduleLoop();
}
