import path from "path";
import fs from "fs/promises";
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

export function pluginSettingsToDefinitions(
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

export async function copyDir(src: string, dest: string): Promise<void> {
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

/**
 * Extract a plugin ZIP and validate its contents.
 * Returns the extracted root directory and parsed manifest.
 */
export async function extractAndValidatePlugin(
  zipPath: string,
  extractDir: string
): Promise<{ rootDir: string; manifest: PluginManifest }> {
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
    throw new PluginInstallError("Plugin archive must contain manifest.json");
  }

  const manifest: PluginManifest = JSON.parse(
    await fs.readFile(manifestPath, "utf-8")
  );

  if (!manifest.name || (!manifest.urlPatterns?.length && !manifest.fileTypes?.length)) {
    throw new PluginInstallError("manifest.json must have name and urlPatterns or fileTypes");
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
    throw new PluginInstallError("Plugin archive must contain index.js or index.mjs");
  }

  return { rootDir, manifest };
}

export interface PluginInstallResult {
  plugin: {
    id: string;
    name: string;
    version: string;
    description: string | null;
    author: string | null;
    urlPatterns: string[];
    fileTypes: string[];
    enabled: boolean;
    hasSettings: boolean;
  };
  updated: boolean;
  requiresConfiguration: boolean;
  settings: SettingDefinition[];
}

/**
 * Install a validated plugin: copy files, register in DB, register settings, reload.
 */
export async function installPlugin(
  rootDir: string,
  manifest: PluginManifest,
  options?: {
    /** Override plugin ID (e.g. from existing DB record) */
    pluginId?: string;
    /** Existing DB record to treat as update */
    existing?: { id: string; enabled: boolean };
  }
): Promise<PluginInstallResult> {
  const pluginId = options?.pluginId ?? slugify(manifest.name);
  const existing = options?.existing;
  const isUpdate = !!existing;

  // Copy to plugins directory
  const pluginsDir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  const destDir = path.join(pluginsDir, pluginId);
  if (isUpdate) {
    await fs.rm(destDir, { recursive: true, force: true });
  }
  await fs.mkdir(destDir, { recursive: true });
  await copyDir(rootDir, destDir);

  // Insert or update DB record
  const db = getDb();
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
    settingDefs = pluginSettingsToDefinitions(pluginId, manifest.name, manifest.settings);
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

  return {
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
  };
}

export class PluginInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginInstallError";
  }
}
