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

    // Migrate legacy plugin:__internal settings to correct plugin groups
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
        // Key format: plugin.{pluginId}.{settingKey}
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

          // Register as hidden so it gets into definitions
          registerSettings([
            {
              key: row.key,
              group: `plugin:${pluginName}`,
              type: "password",
              label: row.label,
              sensitive: true,
              hidden: true,
              sortOrder: 999,
            },
          ]);
        }
      }

      if (internalRows.length > 0) {
        await initializeSettings();
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
