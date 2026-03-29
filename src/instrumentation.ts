export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Install console capture first so all startup logs are captured
    const { installConsoleCapture } = await import("@/lib/log-buffer");
    installConsoleCapture();

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

    // Migrate any legacy plugin:__internal settings to correct group
    {
      const { eq } = await import("drizzle-orm");
      const { schema } = await import("@/db");
      const db = getDb();

      const internalRows = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.group, "plugin:__internal"))
        .all();

      for (const row of internalRows) {
        const parts = row.key.split(".");
        if (parts.length >= 3 && parts[0] === "plugin") {
          const pluginId = parts[1];
          const plugin = db
            .select()
            .from(schema.installedPlugins)
            .where(eq(schema.installedPlugins.id, pluginId))
            .get();
          const pluginName = plugin?.name ?? pluginId;

          db.update(schema.settings)
            .set({ group: `plugin:${pluginName}` })
            .where(eq(schema.settings.key, row.key))
            .run();
        }
      }

      if (internalRows.length > 0) {
        console.log(
          `Migrated ${internalRows.length} legacy __internal settings.`
        );
      }
    }

    // Start the download worker (which also inits plugins)
    const { startWorker } = await import("@/workers/download.worker");
    await startWorker();
    console.log("Archiver worker initialized.");
  }
}
