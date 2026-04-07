export interface DownloadResult {
  success: boolean;
  message: string;
}

export interface PluginSettingDefinition {
  key: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action" | "site-directory-map" | "extension-directory-map" | "file";
  label: string;
  description?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  hidden?: boolean;
  section?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
    accept?: string;
    maxSize?: number;
  };
  sortOrder?: number;
}

export interface PluginViewDeclaration {
  /** Unique view provider ID */
  viewId: string;
  /** Display name in the view toggle (e.g., "Reddit Browser") */
  label: string;
  /** lucide-react icon name for the toggle button */
  icon?: string;
  /** Relative path to the compiled JS view bundle (e.g., "view/index.js") */
  entryPoint: string;
}

export interface PluginThumbnailDeclaration {
  /** Relative path to the compiled JS bundle that registers a thumbnail renderer */
  entryPoint: string;
}

export interface PluginFilePreviewDeclaration {
  /** File extensions this plugin can preview (e.g., ["cbz", "cbr", "epub"]) */
  extensions: string[];
  /** Relative path to the compiled JS bundle that registers the preview renderer */
  entryPoint: string;
}

export interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  urlPatterns: string[];
  fileTypes?: string[];
  settings?: PluginSettingDefinition[];
  viewProvider?: PluginViewDeclaration;
  thumbnailProvider?: PluginThumbnailDeclaration;
  filePreviewProvider?: PluginFilePreviewDeclaration;
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
  process: typeof import("./helpers/process");
  nfo: typeof import("./helpers/nfo");
  http: typeof import("./helpers/http");
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
  fileTypes?: string[];
  settings?: PluginSettingDefinition[];
  actions?: Record<string, (context: ActionContext) => Promise<ActionResult>>;
  viewProvider?: PluginViewDeclaration;
  download: (context: DownloadContext) => Promise<DownloadResult>;
}

export function definePlugin(plugin: ArchiverPlugin): ArchiverPlugin {
  return plugin;
}
