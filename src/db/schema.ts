import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  group: text("group").notNull(),
  type: text("type", {
    enum: ["string", "number", "boolean", "password", "select", "action", "site-directory-map", "extension-directory-map", "file"],
  }).notNull(),
  label: text("label").notNull(),
  description: text("description"),
  defaultValue: text("default_value"),
  validation: text("validation"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const installedPlugins = sqliteTable("installed_plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull().default("1.0.0"),
  description: text("description"),
  author: text("author"),
  urlPatterns: text("url_patterns").notNull(),
  fileTypes: text("file_types"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  hasSettings: integer("has_settings", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  installedAt: integer("installed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const downloadQueue = sqliteTable("download_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  pluginName: text("plugin_name"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const downloadHistory = sqliteTable("download_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  status: text("status", { enum: ["completed", "failed"] }).notNull(),
  pluginName: text("plugin_name"),
  errorMessage: text("error_message"),
  completedAt: integer("completed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const scheduledUrls = sqliteTable("scheduled_urls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  cronExpression: text("cron_expression").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
