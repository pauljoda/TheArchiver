export interface DownloadResult {
  success: boolean;
  message: string;
}

export interface PluginSettingDefinition {
  key: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action";
  label: string;
  description?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  hidden?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
  };
  sortOrder?: number;
}

export interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  urlPatterns: string[];
  settings?: PluginSettingDefinition[];
}

export interface PluginSettingsAccessor {
  get<T = string>(key: string): T;
  set(key: string, value: string): Promise<void>;
}

export interface DownloadContext {
  url: string;
  rootDirectory: string;
  maxDownloadThreads: number;
  helpers: PluginHelpers;
  logger: PluginLogger;
  settings: PluginSettingsAccessor;
}

export interface PluginHelpers {
  html: typeof import("./helpers/html");
  io: typeof import("./helpers/io");
  url: typeof import("./helpers/url");
  string: typeof import("./helpers/string");
}

export interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface ActionContext {
  settings: PluginSettingsAccessor;
  logger: PluginLogger;
}

export interface ActionResult {
  success: boolean;
  message: string;
  settingsUpdates?: Array<{ key: string; value: string }>;
}

export interface ArchiverPlugin {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  urlPatterns: string[];
  settings?: PluginSettingDefinition[];
  actions?: Record<string, (context: ActionContext) => Promise<ActionResult>>;
  download: (context: DownloadContext) => Promise<DownloadResult>;
}

export function definePlugin(plugin: ArchiverPlugin): ArchiverPlugin {
  return plugin;
}
