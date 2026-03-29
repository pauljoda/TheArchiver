import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getPluginAction } from "@/plugins/registry";
import { getSetting, setSetting } from "@/lib/settings";
import { getDb, schema } from "@/db";
import type { PluginSettingsAccessor } from "@/plugins/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, actionKey } = body;

    if (!pluginId || !actionKey) {
      return NextResponse.json(
        { error: "pluginId and actionKey are required" },
        { status: 400 }
      );
    }

    const action = getPluginAction(pluginId, actionKey);
    if (!action) {
      return NextResponse.json(
        { error: `Action "${actionKey}" not found for plugin "${pluginId}"` },
        { status: 404 }
      );
    }

    // Create a settings accessor scoped to this plugin
    const settings: PluginSettingsAccessor = {
      get<T = string>(key: string): T {
        return getSetting<T>(`plugin.${pluginId}.${key}`);
      },
      async set(key: string, value: string): Promise<void> {
        await setSetting(`plugin.${pluginId}.${key}`, value);
      },
    };

    const logger = {
      info: (msg: string) => console.log(`[plugin:${pluginId}] ${msg}`),
      warn: (msg: string) => console.warn(`[plugin:${pluginId}] ${msg}`),
      error: (msg: string) => console.error(`[plugin:${pluginId}] ${msg}`),
    };

    const result = await action({ settings, logger });

    // Apply any settings updates returned by the action
    if (result.settingsUpdates?.length) {
      const db = getDb();
      for (const update of result.settingsUpdates) {
        const fullKey = `plugin.${pluginId}.${update.key}`;
        try {
          await setSetting(fullKey, update.value);
        } catch {
          // Setting not in definitions — upsert directly into DB as hidden internal setting
          const existing = db
            .select()
            .from(schema.settings)
            .where(eq(schema.settings.key, fullKey))
            .get();

          if (existing) {
            db.update(schema.settings)
              .set({ value: update.value, updatedAt: new Date() })
              .where(eq(schema.settings.key, fullKey))
              .run();
          } else {
            db.insert(schema.settings)
              .values({
                key: fullKey,
                value: update.value,
                group: `plugin:__internal`,
                type: "password",
                label: update.key,
                sortOrder: 0,
              })
              .run();
          }
        }
      }
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (err) {
    console.error("Error executing plugin action:", err);
    const message =
      err instanceof Error ? err.message : "Failed to execute action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
