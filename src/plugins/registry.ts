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
import { registerSettings, initializeSettings } from "@/lib/settings";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import * as htmlHelpers from "./helpers/html";
import * as ioHelpers from "./helpers/io";
import * as urlHelpers from "./helpers/url";
import * as stringHelpers from "./helpers/string";

function loadPluginModule(pluginPath: string): Record<string, unknown> {
  const code = fs.readFileSync(pluginPath, "utf-8");
  const pluginRequire = createRequire(pluginPath);
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
}

// Use globalThis to ensure a single shared instance across all Next.js
// webpack bundles (API routes, instrumentation, worker, etc.)
interface PluginRegistryGlobal {
  __pluginRegistry?: Map<string, RegisteredPlugin>;
  __pluginRegistryInitialized?: boolean;
}

const g = globalThis as unknown as PluginRegistryGlobal;
if (!g.__pluginRegistry) g.__pluginRegistry = new Map();

const plugins = g.__pluginRegistry;

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
  };

  for (const pattern of plugin.urlPatterns) {
    const normalized = normalizePattern(pattern);
    plugins.set(normalized, registered);
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
      console.log(
        `Loaded plugin: ${plugin.name} (${plugin.urlPatterns.join(", ")})`
      );
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

        if (!plugin.name || !plugin.urlPatterns || !plugin.download) {
          console.warn(
            `Plugin in ${entry.name} is missing required fields (name, urlPatterns, download)`
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
        console.log(
          `Auto-registered plugin: ${plugin.name} (${plugin.urlPatterns.join(", ")})`
        );
      } catch (err) {
        console.error(`Failed to load plugin from ${entry.name}:`, err);
      }
    }
  }

  // Initialize any newly registered plugin settings
  await initializeSettings();

  setInitialized(true);
}

export function getPluginForUrl(
  url: string
): { plugin: ArchiverPlugin; pluginId: string } | null {
  try {
    const hostname = new URL(url).hostname;

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
      const origin = new URL(url).origin;
      if (pattern === origin || pattern === hostname) {
        return { plugin: registered.plugin, pluginId: registered.pluginId };
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
}

function normalizePattern(pattern: string): string {
  try {
    const url = new URL(pattern);
    return url.hostname;
  } catch {
    return pattern.toLowerCase();
  }
}
