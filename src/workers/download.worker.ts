import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getPluginForUrl, initPlugins, helpers } from "@/plugins/registry";
import { sendNotification } from "@/lib/notifications";
import { getSetting, setSetting } from "@/lib/settings";
import { emitSSEEvent } from "@/lib/events";
import type { PluginLogger, PluginSettingsAccessor } from "@/plugins/types";

const POLL_INTERVAL_MS = 2000;

let started = false;
let activeJobs = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let wakeResolve: (() => void) | null = null;

function createLogger(itemId: number): PluginLogger {
  const prefix = `[Job ${itemId}]`;
  return {
    info: (msg: string) => console.log(`${prefix} ${msg}`),
    warn: (msg: string) => console.warn(`${prefix} ${msg}`),
    error: (msg: string) => console.error(`${prefix} ${msg}`),
  };
}

function createPluginSettings(pluginId: string): PluginSettingsAccessor {
  return {
    get<T = string>(key: string): T {
      return getSetting<T>(`plugin.${pluginId}.${key}`);
    },
    async set(key: string, value: string): Promise<void> {
      await setSetting(`plugin.${pluginId}.${key}`, value);
    },
  };
}

interface QueueItem {
  id: number;
  url: string;
}

async function processDownload(item: QueueItem): Promise<void> {
  const { id: queueItemId, url } = item;
  const db = getDb();
  const logger = createLogger(queueItemId);

  // Find matching plugin
  const match = getPluginForUrl(url);
  if (!match) {
    const errorMessage = `No plugin found for URL: ${url}`;
    logger.error(errorMessage);
    await markFailed(db, queueItemId, url, errorMessage);
    emitSSEEvent({ type: "job:failed", data: { id: queueItemId } });
    await sendNotification("Download Failed", errorMessage, "x");
    return;
  }

  const { plugin, pluginId } = match;
  logger.info(`Downloading ${url} with plugin: ${plugin.name}`);
  emitSSEEvent({ type: "job:active", data: { id: queueItemId } });

  try {
    const result = await plugin.download({
      url,
      rootDirectory: getSetting<string>("core.download_location"),
      maxDownloadThreads: getSetting<number>("core.max_concurrent_downloads"),
      helpers,
      logger,
      settings: createPluginSettings(pluginId),
    });

    if (result.success) {
      const now = new Date();

      // Insert history and delete from queue in parallel
      await Promise.all([
        db.insert(schema.downloadHistory).values({
          url,
          status: "completed",
          pluginName: plugin.name,
          completedAt: now,
        }),
        db
          .delete(schema.downloadQueue)
          .where(eq(schema.downloadQueue.id, queueItemId)),
      ]);

      logger.info(`Completed: ${result.message}`);
      emitSSEEvent({ type: "job:completed", data: { id: queueItemId } });

      // Non-blocking notification
      sendNotification(
        "Download Complete",
        `${plugin.name}: ${result.message}`,
        "white_check_mark"
      ).catch(() => {});
    } else {
      await markFailed(db, queueItemId, url, result.message, plugin.name);
      emitSSEEvent({ type: "job:failed", data: { id: queueItemId } });
      await sendNotification(
        "Download Failed",
        `${plugin.name}: ${result.message}`,
        "x"
      );
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    logger.error(`Error: ${errorMessage}`);
    await markFailed(db, queueItemId, url, errorMessage, plugin.name);
    emitSSEEvent({ type: "job:failed", data: { id: queueItemId } });
    await sendNotification("Download Error", errorMessage, "x");
  }
}

async function markFailed(
  db: ReturnType<typeof getDb>,
  queueItemId: number,
  url: string,
  errorMessage: string,
  pluginName?: string
): Promise<void> {
  const now = new Date();

  // Update queue status and insert history in parallel
  await Promise.all([
    db
      .update(schema.downloadQueue)
      .set({
        status: "failed",
        errorMessage,
        completedAt: now,
        pluginName: pluginName || null,
      })
      .where(eq(schema.downloadQueue.id, queueItemId)),
    db.insert(schema.downloadHistory).values({
      url,
      status: "failed",
      pluginName: pluginName || null,
      errorMessage,
      completedAt: now,
    }),
  ]);
}

async function poll(): Promise<void> {
  try {
    const concurrency = getSetting<number>("core.max_concurrent_downloads");
    const slots = concurrency - activeJobs;
    if (slots <= 0) return;

    const db = getDb();
    const pending = db
      .select()
      .from(schema.downloadQueue)
      .where(eq(schema.downloadQueue.status, "pending"))
      .orderBy(schema.downloadQueue.createdAt)
      .limit(slots)
      .all();

    if (pending.length === 0) return;

    for (const item of pending) {
      // Claim the job immediately
      db.update(schema.downloadQueue)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(schema.downloadQueue.id, item.id))
        .run();

      activeJobs++;
      processDownload({ id: item.id, url: item.url }).finally(() => {
        activeJobs--;
        // Immediately check for more work
        schedulePoll(0);
      });
    }
  } catch (err) {
    console.error("Poll error:", err);
  }
}

function schedulePoll(delayMs: number): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    poll().finally(() => {
      // Schedule next regular poll
      if (started) schedulePoll(POLL_INTERVAL_MS);
    });
  }, delayMs);
}

/** Immediately wake the poll loop to check for new work. */
export function processNow(): void {
  if (started) schedulePoll(0);
}

export async function startWorker(): Promise<void> {
  if (started) return;

  await initPlugins();

  const concurrency = getSetting<number>("core.max_concurrent_downloads");
  console.log(`Download worker started (polling, concurrency: ${concurrency})`);

  started = true;

  // Reset any jobs stuck in "processing" from a previous crash
  const db = getDb();
  db.update(schema.downloadQueue)
    .set({ status: "pending", startedAt: null })
    .where(eq(schema.downloadQueue.status, "processing"))
    .run();

  schedulePoll(0);
}
