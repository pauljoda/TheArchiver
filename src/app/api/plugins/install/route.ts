import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { loadSinglePlugin } from "@/plugins/registry";
import {
  registerSettings,
  initializeSettings,
  getSetting,
} from "@/lib/settings";
import type { PluginManifest, PluginSettingDefinition } from "@/plugins/types";
import type { SettingDefinition } from "@/lib/settings";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

    if (!manifest.name || !manifest.urlPatterns?.length) {
      return NextResponse.json(
        { error: "manifest.json must have name and urlPatterns" },
        { status: 400 }
      );
    }

    // Validate index.js exists
    const indexFile = ["index.js", "index.mjs"].find(async (f) => {
      try {
        await fs.access(path.join(rootDir, f));
        return true;
      } catch {
        return false;
      }
    });

    // Synchronous check since find with async doesn't work
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

    // Check for conflict
    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, pluginId))
      .get();

    if (existing) {
      return NextResponse.json(
        {
          error: `Plugin "${manifest.name}" is already installed. Remove it first to reinstall.`,
        },
        { status: 409 }
      );
    }

    // Copy to plugins directory
    const pluginsDir = path.resolve(process.cwd(), "plugins");
    const destDir = path.join(pluginsDir, pluginId);
    await fs.mkdir(destDir, { recursive: true });

    await copyDir(rootDir, destDir);

    // Insert DB record
    const hasSettings = !!(manifest.settings?.length);
    db.insert(schema.installedPlugins)
      .values({
        id: pluginId,
        name: manifest.name,
        version: manifest.version || "1.0.0",
        description: manifest.description || null,
        author: manifest.author || null,
        urlPatterns: JSON.stringify(manifest.urlPatterns),
        enabled: true,
        hasSettings,
      })
      .run();

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

    // Load plugin into memory
    await loadSinglePlugin(pluginId);

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
          urlPatterns: manifest.urlPatterns,
          enabled: true,
          hasSettings,
        },
        requiresConfiguration,
        settings: settingDefs,
      },
      { status: 201 }
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
