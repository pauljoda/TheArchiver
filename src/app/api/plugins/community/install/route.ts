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
    const body = await request.json();
    const { downloadUrl } = body;

    if (!downloadUrl || typeof downloadUrl !== "string") {
      return NextResponse.json(
        { error: "downloadUrl is required" },
        { status: 400 }
      );
    }

    // Validate download URL against the trusted community registry base URL
    const communityUrl =
      process.env.COMMUNITY_PLUGINS_URL ||
      "https://raw.githubusercontent.com/pauljoda/TheArchiver-CommunityPlugins/main/plugins.json";
    try {
      const manifestRes = await fetch(communityUrl, { cache: "no-store" });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        if (manifest.baseUrl && !downloadUrl.startsWith(manifest.baseUrl)) {
          return NextResponse.json(
            { error: "downloadUrl must originate from the community registry" },
            { status: 400 }
          );
        }
      }
    } catch {
      // If we can't verify, reject the request
      return NextResponse.json(
        { error: "Unable to verify download URL against community registry" },
        { status: 502 }
      );
    }

    // Download the ZIP from the community repo
    const zipRes = await fetch(downloadUrl);
    if (!zipRes.ok) {
      return NextResponse.json(
        { error: `Failed to download plugin: ${zipRes.status} ${zipRes.statusText}` },
        { status: 502 }
      );
    }

    // Write to temp file
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "archiver-community-"));
    const zipPath = path.join(tmpDir, "plugin.zip");
    const buffer = Buffer.from(await zipRes.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract
    const extractDir = path.join(tmpDir, "extracted");
    await fs.mkdir(extractDir, { recursive: true });

    const extract = (await import("extract-zip")).default;
    await extract(zipPath, { dir: extractDir });

    // Find the root
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

    // Find existing plugin by slugified name or by matching display name
    const slugId = slugify(manifest.name);
    const db = getDb();

    let existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, slugId))
      .get();

    // Also search by display name in case the plugin was installed under a
    // different ID (e.g. directory-based ID from deploy scripts)
    if (!existing) {
      existing = db
        .select()
        .from(schema.installedPlugins)
        .where(eq(schema.installedPlugins.name, manifest.name))
        .get();
    }

    const isUpdate = !!existing;
    // Use the existing ID if updating, otherwise use the slugified name
    const pluginId = existing?.id ?? slugId;

    // Copy to plugins directory (remove old files on update)
    const pluginsDir =
      process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
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
          fileTypes: manifest.fileTypes?.length
            ? JSON.stringify(manifest.fileTypes)
            : null,
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
          fileTypes: manifest.fileTypes?.length
            ? JSON.stringify(manifest.fileTypes)
            : null,
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

    await reloadPlugins();

    // Check if any required settings are missing
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
    console.error("Error installing community plugin:", err);
    return NextResponse.json(
      { error: "Failed to install plugin" },
      { status: 500 }
    );
  } finally {
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
