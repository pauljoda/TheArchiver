import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getPluginAction } from "@/plugins/registry";
import {
  getSetting,
  setSetting,
  registerSettings,
  initializeSettings,
} from "@/lib/settings";
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
      // Look up the plugin's display name for the group label
      const db = getDb();
      const dbPlugin = db
        .select()
        .from(schema.installedPlugins)
        .where(eq(schema.installedPlugins.id, pluginId))
        .get();
      const pluginName = dbPlugin?.name ?? pluginId;

      for (const update of result.settingsUpdates) {
        const fullKey = `plugin.${pluginId}.${update.key}`;
        try {
          await setSetting(fullKey, update.value);
        } catch {
          // Setting not in definitions — register as hidden internal setting
          registerSettings([
            {
              key: fullKey,
              group: `plugin:${pluginName}`,
              type: "password",
              label: update.key,
              sensitive: true,
              hidden: true,
              sortOrder: 999,
            },
          ]);
          await initializeSettings();
          await setSetting(fullKey, update.value);
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
