import { getDb, schema } from "@/db";
import { eq, like } from "drizzle-orm";

export interface SettingDefinition {
  key: string;
  group: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action";
  label: string;
  description?: string;
  defaultValue?: string | number | boolean;
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

const definitions = new Map<string, SettingDefinition>();
const cache = new Map<string, unknown>();
let initialized = false;

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
      // Update definition metadata but keep value
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
        })
        .where(eq(schema.settings.key, key))
        .run();

      cache.set(key, deserialize(existing.value, def.type));
    }
  }

  initialized = true;
}

function deserialize(
  raw: string | null,
  type: SettingDefinition["type"]
): unknown {
  if (raw === null || raw === "") return type === "boolean" ? false : raw;

  switch (type) {
    case "number":
      return parseFloat(raw);
    case "boolean":
      return raw === "true" || raw === "1";
    default:
      return raw;
  }
}

export function getSetting<T = string>(key: string): T {
  if (!initialized) {
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

  const serialized = String(value);
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

  const grouped: Record<string, SettingWithValue[]> = {};

  for (const row of rows) {
    const def = definitions.get(row.key);
    const type = (row.type as SettingDefinition["type"]) || "string";

    const setting: SettingWithValue = {
      key: row.key,
      group: row.group,
      type,
      label: row.label,
      description: row.description ?? undefined,
      defaultValue: row.defaultValue
        ? deserialize(row.defaultValue, type)
        : undefined,
      validation: row.validation ? JSON.parse(row.validation) : undefined,
      sortOrder: row.sortOrder,
      value: deserialize(row.value, type) as string | number | boolean | null,
      sensitive: def?.sensitive,
      hidden: def?.hidden,
    } as SettingWithValue;

    if (!grouped[row.group]) {
      grouped[row.group] = [];
    }
    grouped[row.group].push(setting);
  }

  // Sort within groups
  for (const group of Object.values(grouped)) {
    group.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  return grouped;
}

export function getSettingsByGroup(group: string): SettingWithValue[] {
  return getAllSettingsGrouped()[group] ?? [];
}

export async function deleteSettingsByPrefix(prefix: string): Promise<void> {
  const db = getDb();
  db.delete(schema.settings)
    .where(like(schema.settings.key, `${prefix}%`))
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
  const v = def.validation;
  if (!v) return;

  const str = String(value);

  if (v.required && (str === "" || str === "undefined")) {
    throw new Error(`Setting "${def.key}" is required`);
  }

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

  if (v.options && !v.options.some((o) => o.value === str)) {
    throw new Error(`Setting "${def.key}" must be one of the allowed values`);
  }
}

export function isInitialized(): boolean {
  return initialized;
}
