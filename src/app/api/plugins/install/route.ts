import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { reloadPlugins } from "@/plugins/registry";
import {
  registerSettings,
  initializeSettings,
  getSetting,
} from "@/lib/settings";
import type { PluginManifest, PluginSettingDefinition } from "@/plugins/types";
import type { SettingDefinition } from "@/lib/settings";
import { slugify } from "@/plugins/helpers/string";

function pluginSettingsToDefinitions(
  pluginId: string,
  pluginName: string,
  defs: PluginSettingDefinition[]
): SettingDefinition[] {
  return defs.map((d, i) => ({
    key: `plugin.${pluginId}.${d.key}`,
    group: `plugin:${pluginName}`,
    type: d.type,
    label: d.label,
    description: d.description,
    defaultValue: d.defaultValue,
    validation: d.required ? { required: true, ...d.validation } : d.validation,
    sortOrder: d.sortOrder ?? i,
    sensitive: d.type === "password",
  }));
}

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "File must be a .zip archive" },
        { status: 400 }
      );
    }

    // Write upload to temp file
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "archiver-plugin-"));
    const zipPath = path.join(tmpDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract
    const extractDir = path.join(tmpDir, "extracted");
    await fs.mkdir(extractDir, { recursive: true });

    const extract = (await import("extract-zip")).default;
    await extract(zipPath, { dir: extractDir });

    // Find the root - could be directly extracted or in a subfolder
    let rootDir = extractDir;
    const entries = await fs.readdir(extractDir);
    if (
      entries.length === 1 &&
      (await fs.stat(path.join(extractDir, entries[0]))).isDirectory()
    ) {
      rootDir = path.join(extractDir, entries[0]);
    }

    // Validate manifest
    const manifestPath = path.join(rootDir, "manifest.json");
    try {
      await fs.access(manifestPath);
    } catch {
      return NextResponse.json(
        { error: "Plugin archive must contain manifest.json" },
        { status: 400 }
      );
    }

    const manifest: PluginManifest = JSON.parse(
      await fs.readFile(manifestPath, "utf-8")
    );

    if (!manifest.name || (!manifest.urlPatterns?.length && !manifest.fileTypes?.length)) {
      return NextResponse.json(
        { error: "manifest.json must have name and urlPatterns or fileTypes" },
        { status: 400 }
      );
    }

    // Validate index.js exists
    let hasIndex = false;
    for (const f of ["index.js", "index.mjs"]) {
      try {
        await fs.access(path.join(rootDir, f));
        hasIndex = true;
        break;
      } catch {
        // continue
      }
    }

    if (!hasIndex) {
      return NextResponse.json(
        { error: "Plugin archive must contain index.js or index.mjs" },
        { status: 400 }
      );
    }

    // Generate plugin ID
    const pluginId = slugify(manifest.name);
    const db = getDb();

    // Check if plugin already exists (update vs fresh install)
    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, pluginId))
      .get();

    const isUpdate = !!existing;

    // Copy to plugins directory (replace old files on update)
    const pluginsDir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
    const destDir = path.join(pluginsDir, pluginId);
    if (isUpdate) {
      await fs.rm(destDir, { recursive: true, force: true });
    }
    await fs.mkdir(destDir, { recursive: true });

    await copyDir(rootDir, destDir);

    // Insert or update DB record
    const hasSettings = !!(manifest.settings?.length);
    if (isUpdate) {
      db.update(schema.installedPlugins)
        .set({
          name: manifest.name,
          version: manifest.version || "1.0.0",
          description: manifest.description || null,
          author: manifest.author || null,
          urlPatterns: JSON.stringify(manifest.urlPatterns || []),
          fileTypes: manifest.fileTypes?.length ? JSON.stringify(manifest.fileTypes) : null,
          hasSettings,
        })
        .where(eq(schema.installedPlugins.id, pluginId))
        .run();
    } else {
      db.insert(schema.installedPlugins)
        .values({
          id: pluginId,
          name: manifest.name,
          version: manifest.version || "1.0.0",
          description: manifest.description || null,
          author: manifest.author || null,
          urlPatterns: JSON.stringify(manifest.urlPatterns || []),
          fileTypes: manifest.fileTypes?.length ? JSON.stringify(manifest.fileTypes) : null,
          enabled: true,
          hasSettings,
        })
        .run();
    }

    // Register settings
    let settingDefs: SettingDefinition[] = [];
    if (manifest.settings?.length) {
      settingDefs = pluginSettingsToDefinitions(
        pluginId,
        manifest.name,
        manifest.settings
      );
      registerSettings(settingDefs);
      await initializeSettings();
    }

    // Reload all plugins to ensure registry is in sync
    await reloadPlugins();

    // Check if any required settings are missing values
    let requiresConfiguration = false;
    if (manifest.settings?.length) {
      for (const s of manifest.settings) {
        if (s.required) {
          const val = getSetting<string>(`plugin.${pluginId}.${s.key}`);
          if (!val || val === "") {
            requiresConfiguration = true;
            break;
          }
        }
      }
    }

    return NextResponse.json(
      {
        plugin: {
          id: pluginId,
          name: manifest.name,
          version: manifest.version || "1.0.0",
          description: manifest.description || null,
          author: manifest.author || null,
          urlPatterns: manifest.urlPatterns || [],
          fileTypes: manifest.fileTypes || [],
          enabled: existing?.enabled ?? true,
          hasSettings,
        },
        updated: isUpdate,
        requiresConfiguration,
        settings: settingDefs,
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (err) {
    console.error("Error installing plugin:", err);
    return NextResponse.json(
      { error: "Failed to install plugin" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp directory
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
