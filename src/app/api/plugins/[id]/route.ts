import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { unloadPlugin, loadSinglePlugin } from "@/plugins/registry";
import { deleteSettingsByPrefix } from "@/lib/settings";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, id))
      .get();

    if (!existing) {
      return NextResponse.json(
        { error: "Plugin not found" },
        { status: 404 }
      );
    }

    if (typeof body.enabled === "boolean") {
      db.update(schema.installedPlugins)
        .set({ enabled: body.enabled, updatedAt: new Date() })
        .where(eq(schema.installedPlugins.id, id))
        .run();

      if (body.enabled) {
        await loadSinglePlugin(id);
      } else {
        unloadPlugin(id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating plugin:", err);
    return NextResponse.json(
      { error: "Failed to update plugin" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, id))
      .get();

    if (!existing) {
      return NextResponse.json(
        { error: "Plugin not found" },
        { status: 404 }
      );
    }

    // Unload from memory
    unloadPlugin(id);

    // Delete settings
    await deleteSettingsByPrefix(`plugin.${id}.`);

    // Delete DB record
    db.delete(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, id))
      .run();

    // Delete files
    const pluginsDir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
    const pluginDir = path.join(pluginsDir, id);
    await fs.rm(pluginDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error removing plugin:", err);
    return NextResponse.json(
      { error: "Failed to remove plugin" },
      { status: 500 }
    );
  }
}
