import { getDb, schema } from "@/db";
import { eq, like } from "drizzle-orm";

export interface SettingDefinition {
  key: string;
  group: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action" | "site-directory-map" | "extension-directory-map" | "file";
  label: string;
  description?: string;
  defaultValue?: string | number | boolean;
  section?: string;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
  };
  sortOrder?: number;
  envVar?: string;
  sensitive?: boolean;
  hidden?: boolean;
}

export interface SettingWithValue extends SettingDefinition {
  value: string | number | boolean | null;
}

// Use globalThis to ensure a single shared instance across all Next.js
// webpack bundles (API routes, instrumentation, worker, etc.)
interface SettingsGlobal {
  __settingDefinitions?: Map<string, SettingDefinition>;
  __settingCache?: Map<string, unknown>;
  __settingsInitialized?: boolean;
}

const g = globalThis as unknown as SettingsGlobal;
if (!g.__settingDefinitions) g.__settingDefinitions = new Map();
if (!g.__settingCache) g.__settingCache = new Map();

const definitions = g.__settingDefinitions;
const cache = g.__settingCache;

export function registerSettings(defs: SettingDefinition[]): void {
  for (const def of defs) {
    definitions.set(def.key, def);
  }
}

export async function initializeSettings(): Promise<void> {
  const db = getDb();

  for (const [key, def] of definitions) {
    const existing = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .get();

    if (!existing) {
      // Seed from env var or default
      let value: string | null = null;
      if (def.envVar && process.env[def.envVar] !== undefined) {
        value = String(process.env[def.envVar]);
      } else if (def.defaultValue !== undefined) {
        value = String(def.defaultValue);
      }

      db.insert(schema.settings)
        .values({
          key,
          value,
          group: def.group,
          type: def.type,
          label: def.label,
          description: def.description ?? null,
          defaultValue:
            def.defaultValue !== undefined ? String(def.defaultValue) : null,
          validation: def.validation ? JSON.stringify(def.validation) : null,
          sortOrder: def.sortOrder ?? 0,
        })
        .run();

      cache.set(key, deserialize(value, def.type));
    } else {
      // If the DB value is null/empty and an env var is now set, seed from env
      const hasEmptyValue =
        existing.value === null || existing.value === "";
      const envValue =
        def.envVar && process.env[def.envVar] !== undefined
          ? String(process.env[def.envVar])
          : null;
      const newValue =
        hasEmptyValue && envValue ? envValue : existing.value;

      // Update definition metadata (and value if seeded from env)
      db.update(schema.settings)
        .set({
          group: def.group,
          type: def.type,
          label: def.label,
          description: def.description ?? null,
          defaultValue:
            def.defaultValue !== undefined ? String(def.defaultValue) : null,
          validation: def.validation ? JSON.stringify(def.validation) : null,
          sortOrder: def.sortOrder ?? 0,
          ...(newValue !== existing.value ? { value: newValue } : {}),
        })
        .where(eq(schema.settings.key, key))
        .run();

      cache.set(key, deserialize(newValue, def.type));
    }
  }

  // Clean up orphaned non-plugin settings (e.g. removed core settings)
  const allRows = db.select({ key: schema.settings.key }).from(schema.settings).all();
  for (const row of allRows) {
    if (row.key.startsWith("plugin.")) continue; // plugin settings handled by registry
    if (!definitions.has(row.key)) {
      db.delete(schema.settings).where(eq(schema.settings.key, row.key)).run();
      cache.delete(row.key);
    }
  }

  g.__settingsInitialized = true;
}

function deserialize(
  raw: string | null,
  type: SettingDefinition["type"]
): unknown {
  if (raw === null || raw === "" || raw === "null") return type === "boolean" ? false : null;

  switch (type) {
    case "number":
      return parseFloat(raw);
    case "boolean":
      return raw === "true" || raw === "1";
    case "action":
      return null;
    default:
      return raw;
  }
}

export function getSetting<T = string>(key: string): T {
  if (!g.__settingsInitialized) {
    throw new Error(
      `Settings not initialized. Cannot read "${key}" before initializeSettings() completes.`
    );
  }
  if (cache.has(key)) {
    return cache.get(key) as T;
  }
  const def = definitions.get(key);
  if (def?.defaultValue !== undefined) {
    return def.defaultValue as T;
  }
  return undefined as T;
}

export async function setSetting(
  key: string,
  value: unknown
): Promise<void> {
  const def = definitions.get(key);
  if (!def) {
    throw new Error(`Unknown setting: ${key}`);
  }

  validate(value, def);

  const serialized = value === null || value === undefined ? null : String(value);
  const db = getDb();

  db.update(schema.settings)
    .set({ value: serialized, updatedAt: new Date() })
    .where(eq(schema.settings.key, key))
    .run();

  cache.set(key, deserialize(serialized, def.type));
}

export async function setSettings(
  updates: Array<{ key: string; value: unknown }>
): Promise<void> {
  for (const { key, value } of updates) {
    await setSetting(key, value);
  }
}

export function getAllSettingsGrouped(): Record<string, SettingWithValue[]> {
  const db = getDb();
  const rows = db.select().from(schema.settings).all();

  // Build a set of enabled plugin names so we can hide settings for disabled/missing plugins
  // Settings groups use the format "plugin:{pluginName}" where pluginName is the display name
  const enabledPluginNames = new Set(
    db
      .select({ name: schema.installedPlugins.name })
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.enabled, true))
      .all()
      .map((p) => p.name)
  );

  const grouped: Record<string, SettingWithValue[]> = {};

  for (const row of rows) {
    // Skip legacy __internal group entries
    if (row.group === "plugin:__internal") continue;

    // Skip settings for plugins that are disabled or not installed
    if (row.group.startsWith("plugin:")) {
      const pluginName = row.group.slice("plugin:".length);
      if (!enabledPluginNames.has(pluginName)) continue;
    }

    const def = definitions.get(row.key);
    const type = (row.type as SettingDefinition["type"]) || "string";
    const isHidden = def?.hidden ?? false;

    // Skip hidden settings — they should not appear in the UI
    if (isHidden) continue;

    const setting: SettingWithValue = {
      key: row.key,
      group: row.group,
      type,
      label: row.label,
      description: row.description ?? undefined,
      defaultValue: row.defaultValue
        ? deserialize(row.defaultValue, type)
        : undefined,
      section: def?.section,
      validation: row.validation ? JSON.parse(row.validation) : undefined,
      sortOrder: row.sortOrder,
      value: deserialize(row.value, type) as string | number | boolean | null,
      sensitive: def?.sensitive,
      hidden: isHidden,
    } as SettingWithValue;

    if (!grouped[row.group]) {
      grouped[row.group] = [];
    }
    grouped[row.group].push(setting);
  }

  // Sort within groups and remove empty groups
  for (const [group, settings] of Object.entries(grouped)) {
    if (settings.length === 0) {
      delete grouped[group];
    } else {
      settings.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
  }

  return grouped;
}

export async function deleteSettingsByPrefix(prefix: string): Promise<void> {
  const db = getDb();
  // Escape SQL LIKE metacharacters in the prefix
  const escaped = prefix.replace(/[%_]/g, "\\$&");
  db.delete(schema.settings)
    .where(like(schema.settings.key, `${escaped}%`))
    .run();

  // Clear cache entries
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      definitions.delete(key);
    }
  }
}

function validate(value: unknown, def: SettingDefinition): void {
  if (def.type === "action") return;

  const v = def.validation;
  if (!v) return;

  if (v.required && (value == null || value === "")) {
    throw new Error(`Setting "${def.key}" is required`);
  }

  const str = String(value);

  if (def.type === "number") {
    const num = parseFloat(str);
    if (isNaN(num)) throw new Error(`Setting "${def.key}" must be a number`);
    if (v.min !== undefined && num < v.min)
      throw new Error(`Setting "${def.key}" must be at least ${v.min}`);
    if (v.max !== undefined && num > v.max)
      throw new Error(`Setting "${def.key}" must be at most ${v.max}`);
  }

  if (v.pattern && !new RegExp(v.pattern).test(str)) {
    throw new Error(`Setting "${def.key}" does not match required pattern`);
  }

  if (def.type === "select" && v.options && !v.options.some((o) => o.value === str)) {
    throw new Error(`Setting "${def.key}" must be one of the allowed values`);
  }
}

export function isDefinitionRegistered(key: string): boolean {
  return definitions.has(key);
}
