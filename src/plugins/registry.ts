import path from "path";
import fs from "fs";
import vm from "vm";
import { createRequire } from "module";
import type {
  ArchiverPlugin,
  ActionContext,
  ActionResult,
  PluginHelpers,
  PluginManifest,
  PluginSettingDefinition,
} from "./types";
import type { SettingDefinition } from "@/lib/settings";
import {
  registerSettings,
  initializeSettings,
  isDefinitionRegistered,
} from "@/lib/settings";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import * as htmlHelpers from "./helpers/html";
import * as ioHelpers from "./helpers/io";
import * as urlHelpers from "./helpers/url";
import * as stringHelpers from "./helpers/string";

/**
 * Wrap child_process.exec to resolve relative paths in shell commands.
 *
 * Plugins often do `cd "relative/temp" && zip -r "relative/output" .`
 * which breaks because after `cd`, the second relative path resolves
 * from the new cwd, not the original process root.  Resolving all
 * relative paths inside double-quotes to absolute paths fixes this.
 */
function patchChildProcess(
  original: typeof import("child_process")
): typeof import("child_process") {
  const origExec = original.exec;

  const patched = function exec(
    cmd: string,
    ...rest: unknown[]
  ): ReturnType<typeof origExec> {
    const fixed = cmd.replace(
      /"((?:[a-zA-Z0-9._])[^"]*\/[^"]*)"/g,
      (match, p: string) => {
        if (path.isAbsolute(p)) return match;
        return `"${path.resolve(p)}"`;
      }
    );
    return (origExec as Function).call(original, fixed, ...rest);
  } as typeof origExec;

  return { ...original, exec: patched };
}

function loadPluginModule(pluginPath: string): Record<string, unknown> {
  const code = fs.readFileSync(pluginPath, "utf-8");
  const baseRequire = createRequire(pluginPath);

  // Wrap require to patch child_process for plugins
  const pluginRequire = Object.assign(
    function (id: string) {
      const mod = baseRequire(id);
      if (id === "child_process") return patchChildProcess(mod);
      return mod;
    },
    { resolve: baseRequire.resolve }
  );

  const mod = { exports: {} as Record<string, unknown> };
  const wrapper = `(function(exports, require, module, __filename, __dirname) {\n${code}\n});`;
  const compiled = vm.runInThisContext(wrapper, { filename: pluginPath });
  compiled(
    mod.exports,
    pluginRequire,
    mod,
    pluginPath,
    path.dirname(pluginPath)
  );
  return mod.exports;
}

interface RegisteredPlugin {
  plugin: ArchiverPlugin;
  pluginId: string;
  patterns: string[];
  fileTypes?: string[];
}

// Use globalThis to ensure a single shared instance across all Next.js
// webpack bundles (API routes, instrumentation, worker, etc.)
interface PluginRegistryGlobal {
  __pluginRegistry?: Map<string, RegisteredPlugin>;
  __pluginRegistryInitialized?: boolean;
  __fileTypePlugins?: RegisteredPlugin[];
}

const g = globalThis as unknown as PluginRegistryGlobal;
if (!g.__pluginRegistry) g.__pluginRegistry = new Map();
if (!g.__fileTypePlugins) g.__fileTypePlugins = [];

const plugins = g.__pluginRegistry;
const fileTypePlugins = g.__fileTypePlugins;

function getInitialized() {
  return g.__pluginRegistryInitialized ?? false;
}
function setInitialized(v: boolean) {
  g.__pluginRegistryInitialized = v;
}

export const helpers: PluginHelpers = {
  html: htmlHelpers,
  io: ioHelpers,
  url: urlHelpers,
  string: stringHelpers,
};

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
    hidden: d.hidden,
  }));
}

function registerPlugin(
  plugin: ArchiverPlugin,
  pluginId: string
): void {
  const registered: RegisteredPlugin = {
    plugin,
    pluginId,
    patterns: plugin.urlPatterns,
    fileTypes: plugin.fileTypes,
  };

  for (const pattern of plugin.urlPatterns) {
    const normalized = normalizePattern(pattern);
    plugins.set(normalized, registered);
  }

  if (plugin.fileTypes?.length) {
    const existing = fileTypePlugins.findIndex(r => r.pluginId === pluginId);
    if (existing >= 0) fileTypePlugins[existing] = registered;
    else fileTypePlugins.push(registered);
  }
}

export async function initPlugins(pluginsDir?: string): Promise<void> {
  if (getInitialized()) return;

  const dir = pluginsDir || process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  const db = getDb();

  // Load plugins tracked in DB
  const dbPlugins = db.select().from(schema.installedPlugins).all();
  const trackedIds = new Set(dbPlugins.map((p) => p.id));

  for (const dbPlugin of dbPlugins) {
    if (!dbPlugin.enabled) continue;

    const pluginDir = path.join(dir, dbPlugin.id);
    const indexFile = ["index.js", "index.mjs"].find((f) =>
      fs.existsSync(path.join(pluginDir, f))
    );

    if (!indexFile) {
      console.warn(
        `Plugin ${dbPlugin.id} tracked in DB but files missing at ${pluginDir}`
      );
      continue;
    }

    try {
      const pluginPath = path.join(pluginDir, indexFile);
      const pluginModule = loadPluginModule(pluginPath);
      const plugin = (pluginModule.default || pluginModule) as ArchiverPlugin;

      // Register plugin settings if manifest declares them
      const manifestPath = path.join(pluginDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest: PluginManifest = JSON.parse(
          fs.readFileSync(manifestPath, "utf-8")
        );
        if (manifest.settings?.length) {
          const settingDefs = pluginSettingsToDefinitions(
            dbPlugin.id,
            dbPlugin.name,
            manifest.settings
          );
          registerSettings(settingDefs);
        }
      } else if (plugin.settings?.length) {
        const settingDefs = pluginSettingsToDefinitions(
          dbPlugin.id,
          plugin.name,
          plugin.settings
        );
        registerSettings(settingDefs);
      }

      registerPlugin(plugin, dbPlugin.id);
      const patternInfo = plugin.urlPatterns.length
        ? plugin.urlPatterns.join(", ")
        : `file types: ${plugin.fileTypes?.join(", ") || "none"}`;
      console.log(`Loaded plugin: ${plugin.name} (${patternInfo})`);
    } catch (err) {
      console.error(`Failed to load plugin ${dbPlugin.id}:`, err);
    }
  }

  // Auto-register untracked plugin directories (legacy compatibility)
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (trackedIds.has(entry.name)) continue;

      const pluginDir = path.join(dir, entry.name);
      const indexFile = ["index.js", "index.mjs"].find((f) =>
        fs.existsSync(path.join(pluginDir, f))
      );

      if (!indexFile) continue;

      try {
        const pluginPath = path.join(pluginDir, indexFile);
        const pluginModule = loadPluginModule(pluginPath);
        const plugin = (pluginModule.default || pluginModule) as ArchiverPlugin;

        if (!plugin.name || (!plugin.urlPatterns?.length && !plugin.fileTypes?.length) || !plugin.download) {
          console.warn(
            `Plugin in ${entry.name} is missing required fields (name, urlPatterns or fileTypes, download)`
          );
          continue;
        }

        // Try to load manifest for metadata
        let manifest: PluginManifest | null = null;
        const manifestPath = path.join(pluginDir, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        }

        const pluginId = entry.name;
        const hasSettings = !!(
          (manifest?.settings?.length) ||
          (plugin.settings?.length)
        );

        // Auto-insert into DB
        db.insert(schema.installedPlugins)
          .values({
            id: pluginId,
            name: manifest?.name || plugin.name,
            version: manifest?.version || plugin.version || "0.0.0",
            description:
              manifest?.description || plugin.description || null,
            author: manifest?.author || plugin.author || null,
            urlPatterns: JSON.stringify(plugin.urlPatterns),
            fileTypes: plugin.fileTypes?.length ? JSON.stringify(plugin.fileTypes) : null,
            enabled: true,
            hasSettings,
          })
          .run();

        // Register plugin settings
        const settingsDefs =
          manifest?.settings || plugin.settings;
        if (settingsDefs?.length) {
          const defs = pluginSettingsToDefinitions(
            pluginId,
            plugin.name,
            settingsDefs
          );
          registerSettings(defs);
        }

        registerPlugin(plugin, pluginId);
        const autoPatternInfo = plugin.urlPatterns.length
          ? plugin.urlPatterns.join(", ")
          : `file types: ${plugin.fileTypes?.join(", ") || "none"}`;
        console.log(`Auto-registered plugin: ${plugin.name} (${autoPatternInfo})`);
      } catch (err) {
        console.error(`Failed to load plugin from ${entry.name}:`, err);
      }
    }
  }

  // Initialize any newly registered plugin settings
  await initializeSettings();

  // Re-register orphaned plugin settings (e.g. auth tokens created by
  // plugin actions) as hidden. These exist in the DB but aren't in the
  // manifest, so they lose their hidden flag on reboot.
  const allSettings = db.select().from(schema.settings).all();
  let orphanCount = 0;
  for (const row of allSettings) {
    if (!row.key.startsWith("plugin.")) continue;
    if (isDefinitionRegistered(row.key)) continue;

    // This is a plugin setting in the DB that has no definition — register
    // it as hidden so it doesn't appear in the settings UI
    const parts = row.key.split(".");
    const pluginId = parts[1];
    const dbPlugin = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, pluginId))
      .get();
    const pluginName = dbPlugin?.name ?? pluginId;

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
    orphanCount++;
  }

  if (orphanCount > 0) {
    await initializeSettings();
    console.log(
      `Re-registered ${orphanCount} hidden plugin settings.`
    );
  }

  setInitialized(true);
}

export function getPluginForUrl(
  url: string
): { plugin: ArchiverPlugin; pluginId: string } | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Try exact match first
    if (plugins.has(hostname)) {
      const reg = plugins.get(hostname)!;
      return { plugin: reg.plugin, pluginId: reg.pluginId };
    }

    // Try matching with wildcard patterns
    for (const [pattern, registered] of plugins) {
      if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(2);
        if (hostname === suffix || hostname.endsWith("." + suffix)) {
          return { plugin: registered.plugin, pluginId: registered.pluginId };
        }
      }
      // Also match by origin (scheme + host)
      const origin = parsed.origin;
      if (pattern === origin || pattern === hostname) {
        return { plugin: registered.plugin, pluginId: registered.pluginId };
      }
    }

    // File-type fallback: match by file extension in URL path
    const ext = path.extname(parsed.pathname).toLowerCase();
    if (ext) {
      for (const registered of fileTypePlugins) {
        if (registered.fileTypes?.includes(ext)) {
          return { plugin: registered.plugin, pluginId: registered.pluginId };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function getLoadedPlugins(): Array<{
  name: string;
  urlPatterns: string[];
}> {
  const seen = new Set<string>();
  const result: Array<{ name: string; urlPatterns: string[] }> = [];

  for (const registered of plugins.values()) {
    if (!seen.has(registered.plugin.name)) {
      seen.add(registered.plugin.name);
      result.push({
        name: registered.plugin.name,
        urlPatterns: registered.patterns,
      });
    }
  }

  return result;
}

export function getPluginAction(
  pluginId: string,
  actionKey: string
): ((context: ActionContext) => Promise<ActionResult>) | null {
  for (const registered of plugins.values()) {
    if (registered.pluginId === pluginId) {
      return registered.plugin.actions?.[actionKey] ?? null;
    }
  }
  return null;
}

export async function loadSinglePlugin(
  pluginId: string,
  pluginsDir?: string
): Promise<void> {
  const dir = pluginsDir || process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  const pluginDir = path.join(dir, pluginId);

  const indexFile = ["index.js", "index.mjs"].find((f) =>
    fs.existsSync(path.join(pluginDir, f))
  );

  if (!indexFile) {
    throw new Error(`No index.js found in plugin directory: ${pluginDir}`);
  }

  const pluginPath = path.join(pluginDir, indexFile);
  const pluginModule = loadPluginModule(pluginPath);
  const plugin = (pluginModule.default || pluginModule) as ArchiverPlugin;

  registerPlugin(plugin, pluginId);

  // Load manifest settings
  const manifestPath = path.join(pluginDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest: PluginManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );
    if (manifest.settings?.length) {
      const settingDefs = pluginSettingsToDefinitions(
        pluginId,
        plugin.name,
        manifest.settings
      );
      registerSettings(settingDefs);
      await initializeSettings();
    }
  }
}

export async function reloadPlugins(pluginsDir?: string): Promise<void> {
  // Clear all registered plugins
  plugins.clear();
  fileTypePlugins.length = 0;
  setInitialized(false);
  await initPlugins(pluginsDir);
}

export function unloadPlugin(pluginId: string): void {
  const keysToRemove: string[] = [];
  for (const [pattern, registered] of plugins) {
    if (registered.pluginId === pluginId) {
      keysToRemove.push(pattern);
    }
  }
  for (const key of keysToRemove) {
    plugins.delete(key);
  }

  const ftIdx = fileTypePlugins.findIndex(r => r.pluginId === pluginId);
  if (ftIdx >= 0) fileTypePlugins.splice(ftIdx, 1);
}

function normalizePattern(pattern: string): string {
  try {
    const url = new URL(pattern);
    return url.hostname;
  } catch {
    return pattern.toLowerCase();
  }
}
