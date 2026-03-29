export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run database migrations first
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { getDb } = await import("@/db");
    const path = await import("path");

    try {
      migrate(getDb(), {
        migrationsFolder: path.resolve("drizzle"),
      });
      console.log("Database migrations complete.");
    } catch (err) {
      console.error("Migration failed:", err);
    }

    const { registerSettings, initializeSettings } = await import(
      "@/lib/settings"
    );
    const { CORE_SETTINGS } = await import("@/lib/settings-defs");

    // Register and seed core settings from env vars / defaults
    registerSettings(CORE_SETTINGS);
    await initializeSettings();
    console.log("Settings initialized.");

    // Start the download worker (which also inits plugins)
    const { startWorker } = await import("@/workers/download.worker");
    await startWorker();
    console.log("Archiver worker initialized.");
  }
}
