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
  PluginViewDeclaration,
  PluginThumbnailDeclaration,
  PluginFilePreviewDeclaration,
} from "./types";
import type { SettingDefinition } from "@/lib/settings";
import {
  registerSettings,
  initializeSettings,
  isDefinitionRegistered,
  getSetting,
} from "@/lib/settings";
import { getDb, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import * as htmlHelpers from "./helpers/html";
import * as ioHelpers from "./helpers/io";
import * as urlHelpers from "./helpers/url";
import * as stringHelpers from "./helpers/string";
import * as processHelpers from "./helpers/process";
import * as nfoHelpers from "./helpers/nfo";
import * as httpHelpers from "./helpers/http";
import * as flaresolverrHelpers from "./helpers/flaresolverr";
import filesPlugin from "./builtins/files";

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

const DIRECT_FILE_URL_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".tiff",
  ".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".flv", ".wmv",
  ".mp3", ".flac", ".wav", ".ogg", ".aac", ".wma", ".m4a",
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
  ".txt", ".md", ".json", ".xml", ".csv",
]);

export interface ViewProviderRegistration {
  pluginId: string;
  viewId: string;
  label: string;
  icon?: string;
  entryPoint: string;
  /** Setting key to resolve the tracked directory (e.g., "plugin.plugin-social.save_directory") */
  directorySettingKey: string;
  /** Fallback directory name when no value is stored in settings (from the setting's defaultValue) */
  directoryDefaultValue?: string;
}

export interface ViewProviderInfo {
  pluginId: string;
  viewId: string;
  label: string;
  icon?: string;
  trackedDirectory: string;
}

export interface ThumbnailProviderRegistration {
  pluginId: string;
  entryPoint: string;
  /** Setting key to resolve the tracked directory */
  directorySettingKey: string;
  /** Fallback directory name when no value is stored in settings */
  directoryDefaultValue?: string;
}

export interface FilePreviewProviderRegistration {
  pluginId: string;
  extensions: string[];
  entryPoint: string;
}

function getTrackedDirectoryValue(primaryKey: string, defaultValue?: string): string {
  const primary = getSetting<string>(primaryKey);
  if (primary) return primary;

  const legacyKey = primaryKey.replace(/\.save_directory$/, ".library_folder");
  if (legacyKey !== primaryKey) {
    const legacy = getSetting<string>(legacyKey);
    if (legacy) return legacy;
  }

  return defaultValue || "";
}

/**
 * Resolve all tracked directories for a plugin — the primary directory plus
 * any per-site directory overrides from the site_directories setting.
 * This allows view providers to activate on all configured output folders.
 */
function getAllTrackedDirectories(directorySettingKey: string, directoryDefaultValue?: string): string[] {
  const dirs: string[] = [];

  const primary = getTrackedDirectoryValue(directorySettingKey, directoryDefaultValue);
  if (primary) dirs.push(primary);

  // Check for site_directories setting (JSON map of domain → folder)
  const siteDirectoriesKey = directorySettingKey.replace(
    /\.(save_directory|library_folder)$/,
    ".site_directories"
  );
  try {
    const raw = getSetting<string>(siteDirectoriesKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const folder of Object.values(parsed)) {
          if (typeof folder === "string" && folder && !dirs.includes(folder)) {
            dirs.push(folder);
          }
        }
      }
    }
  } catch {
    // Invalid JSON or missing setting — ignore
  }

  return dirs;
}

// Use globalThis to ensure a single shared instance across all Next.js
// webpack bundles (API routes, instrumentation, worker, etc.)
interface PluginRegistryGlobal {
  __pluginRegistry?: Map<string, RegisteredPlugin>;
  __pluginRegistryInitialized?: boolean;
  __pluginRegistryInitPromise?: Promise<void>;
  __fileTypePlugins?: RegisteredPlugin[];
  __fallbackPlugin?: RegisteredPlugin;
  __viewProviderRegistry?: Map<string, ViewProviderRegistration>;
  __thumbnailProviderRegistry?: Map<string, ThumbnailProviderRegistration>;
  __filePreviewProviderRegistry?: Map<string, FilePreviewProviderRegistration>;
}

const g = globalThis as unknown as PluginRegistryGlobal;
if (!g.__pluginRegistry) g.__pluginRegistry = new Map();
if (!g.__fileTypePlugins) g.__fileTypePlugins = [];
if (!g.__viewProviderRegistry) g.__viewProviderRegistry = new Map();
if (!g.__thumbnailProviderRegistry) g.__thumbnailProviderRegistry = new Map();
if (!g.__filePreviewProviderRegistry) g.__filePreviewProviderRegistry = new Map();

const plugins = g.__pluginRegistry;
const fileTypePlugins = g.__fileTypePlugins;
const viewProviders = g.__viewProviderRegistry!;
const thumbnailProviders = g.__thumbnailProviderRegistry!;
const filePreviewProviders = g.__filePreviewProviderRegistry!;

function getInitialized() {
  return g.__pluginRegistryInitialized ?? false;
}
function setInitialized(v: boolean) {
  g.__pluginRegistryInitialized = v;
}

export const helpers: PluginHelpers = {
  html: {
    ...htmlHelpers,
    fetchPage: (url, options) =>
      htmlHelpers.fetchPage(url, {
        ...options,
        flaresolverrUrl:
          options?.flaresolverrUrl?.trim() ||
          getSetting<string>("core.flaresolverr_url")?.trim() ||
          undefined,
      }),
  },
  io: ioHelpers,
  url: urlHelpers,
  string: stringHelpers,
  process: processHelpers,
  nfo: nfoHelpers,
  http: httpHelpers,
  flaresolverr: flaresolverrHelpers,
};

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
    section: d.section,
    validation: d.required ? { required: true, ...d.validation } : d.validation,
    sortOrder: d.sortOrder ?? i,
    sensitive: d.type === "password",
    hidden: d.hidden,
  }));
}

/** Extract the default directory value from a plugin's manifest settings array. */
function extractDirectoryDefault(settings: Array<{ key: string; defaultValue?: unknown }> | undefined): string {
  if (!settings) return "";
  const s = settings.find((s) => s.key === "save_directory" || s.key === "library_folder");
  return typeof s?.defaultValue === "string" ? s.defaultValue : "";
}

function registerViewProvider(
  pluginId: string,
  view: PluginViewDeclaration,
  directorySettingKey: string,
  directoryDefaultValue?: string
): void {
  viewProviders.set(pluginId, {
    pluginId,
    viewId: view.viewId,
    label: view.label,
    icon: view.icon,
    entryPoint: view.entryPoint,
    directorySettingKey,
    directoryDefaultValue,
  });
}

function registerThumbnailProvider(
  pluginId: string,
  thumb: PluginThumbnailDeclaration,
  directorySettingKey: string,
  directoryDefaultValue?: string
): void {
  thumbnailProviders.set(pluginId, {
    pluginId,
    entryPoint: thumb.entryPoint,
    directorySettingKey,
    directoryDefaultValue,
  });
}

function registerFilePreviewProvider(
  pluginId: string,
  preview: PluginFilePreviewDeclaration
): void {
  filePreviewProviders.set(pluginId, {
    pluginId,
    extensions: preview.extensions.map((e) => e.toLowerCase()),
    entryPoint: preview.entryPoint,
  });
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

const BUILTIN_FILES_ID = "builtin-files";

export async function initPlugins(pluginsDir?: string): Promise<void> {
  if (getInitialized()) return;
  // Prevent concurrent initialization — return existing promise if in progress
  if (g.__pluginRegistryInitPromise) return g.__pluginRegistryInitPromise;
  g.__pluginRegistryInitPromise = doInitPlugins(pluginsDir);
  try {
    await g.__pluginRegistryInitPromise;
  } finally {
    g.__pluginRegistryInitPromise = undefined;
  }
}

async function doInitPlugins(pluginsDir?: string): Promise<void> {
  const dir = pluginsDir || process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  const db = getDb();

  // ── Load built-in Files plugin ──
  {
    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, BUILTIN_FILES_ID))
      .get();

    if (!existing) {
      db.insert(schema.installedPlugins)
        .values({
          id: BUILTIN_FILES_ID,
          name: filesPlugin.name,
          version: filesPlugin.version || "1.0.0",
          description: filesPlugin.description || "Download any file and organize by extension",
          author: filesPlugin.author || "TheArchiver",
          urlPatterns: JSON.stringify([]),
          fileTypes: null,
          enabled: true,
          hasSettings: true,
        })
        .run();
    }

    const builtinRow = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, BUILTIN_FILES_ID))
      .get();

    if (builtinRow?.enabled) {
      if (filesPlugin.settings?.length) {
        const settingDefs = pluginSettingsToDefinitions(
          BUILTIN_FILES_ID,
          filesPlugin.name,
          filesPlugin.settings
        );
        registerSettings(settingDefs);
      }
      g.__fallbackPlugin = {
        plugin: filesPlugin,
        pluginId: BUILTIN_FILES_ID,
        patterns: [],
      };
      console.log("Loaded built-in plugin: Files (fallback)");
    } else {
      g.__fallbackPlugin = undefined;
    }
  }

  // Load plugins tracked in DB (ordered by sort_order for matching priority)
  const dbPlugins = db
    .select()
    .from(schema.installedPlugins)
    .orderBy(asc(schema.installedPlugins.sortOrder))
    .all();
  const trackedIds = new Set(dbPlugins.map((p) => p.id));

  for (const dbPlugin of dbPlugins) {
    if (!dbPlugin.enabled) continue;
    // Skip built-in plugins — they are loaded directly, not from disk
    if (dbPlugin.id.startsWith("builtin-")) continue;

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
      let manifest: PluginManifest | null = null;
      const manifestPath = path.join(pluginDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(
          fs.readFileSync(manifestPath, "utf-8")
        );
        if (manifest!.settings?.length) {
          const settingDefs = pluginSettingsToDefinitions(
            dbPlugin.id,
            dbPlugin.name,
            manifest!.settings!
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

      // Register view provider if manifest declares one
      const viewDecl = manifest?.viewProvider || plugin.viewProvider;
      if (viewDecl) {
        registerViewProvider(
          dbPlugin.id,
          viewDecl,
          `plugin.${dbPlugin.id}.save_directory`,
          extractDirectoryDefault(manifest?.settings ?? plugin.settings)
        );
      }

      // Register thumbnail provider if manifest declares one
      const thumbDecl = manifest?.thumbnailProvider;
      if (thumbDecl) {
        registerThumbnailProvider(
          dbPlugin.id,
          thumbDecl,
          `plugin.${dbPlugin.id}.save_directory`,
          extractDirectoryDefault(manifest?.settings ?? plugin.settings)
        );
      }

      // Register file preview provider if manifest declares one
      const previewDecl = manifest?.filePreviewProvider;
      if (previewDecl) {
        registerFilePreviewProvider(dbPlugin.id, previewDecl);
      }

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

        // Register view provider if declared
        const viewDecl = manifest?.viewProvider || plugin.viewProvider;
        if (viewDecl) {
          registerViewProvider(
            pluginId,
            viewDecl,
            `plugin.${pluginId}.save_directory`,
            extractDirectoryDefault(manifest?.settings ?? plugin.settings)
          );
        }

        // Register thumbnail provider if declared
        const thumbDecl2 = manifest?.thumbnailProvider;
        if (thumbDecl2) {
          registerThumbnailProvider(
            pluginId,
            thumbDecl2,
            `plugin.${pluginId}.save_directory`,
            extractDirectoryDefault(manifest?.settings ?? plugin.settings)
          );
        }

        const previewDecl2 = manifest?.filePreviewProvider;
        if (previewDecl2) {
          registerFilePreviewProvider(pluginId, previewDecl2);
        }

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

    // Built-in Files fallback only makes sense for URLs that look like
    // direct file downloads, not arbitrary page URLs after a plugin removal.
    if (g.__fallbackPlugin && ext && DIRECT_FILE_URL_EXTS.has(ext)) {
      return {
        plugin: g.__fallbackPlugin.plugin,
        pluginId: g.__fallbackPlugin.pluginId,
      };
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
  // Handle built-in plugin re-enable
  if (pluginId === BUILTIN_FILES_ID) {
    if (filesPlugin.settings?.length) {
      const settingDefs = pluginSettingsToDefinitions(
        BUILTIN_FILES_ID,
        filesPlugin.name,
        filesPlugin.settings
      );
      registerSettings(settingDefs);
      await initializeSettings();
    }
    g.__fallbackPlugin = {
      plugin: filesPlugin,
      pluginId: BUILTIN_FILES_ID,
      patterns: [],
    };
    return;
  }

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

  // Load manifest settings and view provider
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
    const viewDecl = manifest.viewProvider || plugin.viewProvider;
    if (viewDecl) {
      registerViewProvider(
        pluginId,
        viewDecl,
        `plugin.${pluginId}.save_directory`,
        extractDirectoryDefault(manifest.settings ?? plugin.settings)
      );
    }
    const thumbDecl3 = manifest.thumbnailProvider;
    if (thumbDecl3) {
      registerThumbnailProvider(
        pluginId,
        thumbDecl3,
        `plugin.${pluginId}.save_directory`,
        extractDirectoryDefault(manifest.settings ?? plugin.settings)
      );
    }
    const previewDecl3 = manifest.filePreviewProvider;
    if (previewDecl3) {
      registerFilePreviewProvider(pluginId, previewDecl3);
    }
  }
}

export async function reloadPlugins(pluginsDir?: string): Promise<void> {
  // Clear all registered plugins
  plugins.clear();
  fileTypePlugins.length = 0;
  viewProviders.clear();
  thumbnailProviders.clear();
  filePreviewProviders.clear();
  g.__fallbackPlugin = undefined;
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

  if (g.__fallbackPlugin?.pluginId === pluginId) {
    g.__fallbackPlugin = undefined;
  }

  viewProviders.delete(pluginId);
  thumbnailProviders.delete(pluginId);
  filePreviewProviders.delete(pluginId);
}

export function getThumbnailProviderForPath(relativePath: string): ThumbnailProviderRegistration | null {
  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, "");

  for (const reg of thumbnailProviders.values()) {
    let trackedDirs: string[];
    try {
      trackedDirs = getAllTrackedDirectories(reg.directorySettingKey, reg.directoryDefaultValue);
    } catch {
      continue;
    }

    for (const trackedDir of trackedDirs) {
      if (!trackedDir) continue;

      const normalizedTracked = trackedDir.replace(/^\/+|\/+$/g, "");

      if (
        normalizedPath === normalizedTracked ||
        normalizedPath.startsWith(normalizedTracked + "/")
      ) {
        return reg;
      }
    }
  }
  return null;
}

export function getThumbnailProviderEntry(pluginId: string): { entryPoint: string; pluginsDir: string } | null {
  const reg = thumbnailProviders.get(pluginId);
  if (!reg) return null;
  const dir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  return {
    entryPoint: path.join(dir, pluginId, reg.entryPoint),
    pluginsDir: dir,
  };
}

export function getFilePreviewProviderForExtension(ext: string): { pluginId: string; entryPoint: string } | null {
  const normalizedExt = ext.toLowerCase();
  for (const reg of filePreviewProviders.values()) {
    if (reg.extensions.includes(normalizedExt)) {
      const dir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
      return {
        pluginId: reg.pluginId,
        entryPoint: path.join(dir, reg.pluginId, reg.entryPoint),
      };
    }
  }
  return null;
}

export function getFilePreviewProviderEntry(pluginId: string): { entryPoint: string; pluginsDir: string } | null {
  const reg = filePreviewProviders.get(pluginId);
  if (!reg) return null;
  const dir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  return {
    entryPoint: path.join(dir, pluginId, reg.entryPoint),
    pluginsDir: dir,
  };
}

/** Returns all file extensions handled by registered preview providers. */
export function getPluginPreviewExtensions(): string[] {
  const exts: string[] = [];
  for (const reg of filePreviewProviders.values()) {
    exts.push(...reg.extensions);
  }
  return exts;
}

export function getViewProvidersForPath(relativePath: string): ViewProviderInfo[] {
  const results: ViewProviderInfo[] = [];
  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, "");

  for (const reg of viewProviders.values()) {
    let trackedDirs: string[];
    try {
      trackedDirs = getAllTrackedDirectories(reg.directorySettingKey, reg.directoryDefaultValue);
    } catch {
      // Settings not initialized or key not found — skip
      continue;
    }

    for (const trackedDir of trackedDirs) {
      if (!trackedDir) continue;

      // Normalize: remove leading/trailing slashes for comparison
      const normalizedTracked = trackedDir.replace(/^\/+|\/+$/g, "");

      if (
        normalizedPath === normalizedTracked ||
        normalizedPath.startsWith(normalizedTracked + "/")
      ) {
        results.push({
          pluginId: reg.pluginId,
          viewId: reg.viewId,
          label: reg.label,
          icon: reg.icon,
          trackedDirectory: normalizedTracked,
        });
        break; // Found a match for this provider, no need to check other dirs
      }
    }
  }

  return results;
}

export function getViewProviderEntry(pluginId: string): { entryPoint: string; pluginsDir: string } | null {
  const reg = viewProviders.get(pluginId);
  if (!reg) return null;
  const dir = process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");
  return {
    entryPoint: path.join(dir, pluginId, reg.entryPoint),
    pluginsDir: dir,
  };
}

function normalizePattern(pattern: string): string {
  try {
    const url = new URL(pattern);
    return url.hostname;
  } catch {
    return pattern.toLowerCase();
  }
}
