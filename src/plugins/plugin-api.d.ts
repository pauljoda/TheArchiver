/**
 * TheArchiver Plugin API — Type Declarations
 *
 * Copy or reference this file in external plugin projects to get type checking
 * without depending on the full TheArchiver codebase.
 *
 * Usage in a plugin project:
 *   1. Copy this file into your plugin's source directory
 *   2. Import types: `import type { ArchiverPlugin, DownloadContext } from "./plugin-api";`
 *   3. Use `definePlugin()` to get type-checked plugin definitions
 */

// ─── Core Plugin Interface ──────────────────────────────────────────────────

export interface DownloadResult {
  success: boolean;
  message: string;
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

export declare function definePlugin(plugin: ArchiverPlugin): ArchiverPlugin;

// ─── Contexts ───────────────────────────────────────────────────────────────

export interface DownloadContext {
  url: string;
  rootDirectory: string;
  maxDownloadThreads: number;
  helpers: PluginHelpers;
  logger: PluginLogger;
  settings: PluginSettingsAccessor;
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

// ─── Settings ───────────────────────────────────────────────────────────────

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

export interface PluginSettingsAccessor {
  get<T = string>(key: string): T;
  set(key: string, value: string): Promise<void>;
}

// ─── Logging ────────────────────────────────────────────────────────────────

export interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

// ─── Manifest ───────────────────────────────────────────────────────────────

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

// ─── Provider Declarations ──────────────────────────────────────────────────

export interface PluginViewDeclaration {
  viewId: string;
  label: string;
  icon?: string;
  entryPoint: string;
}

export interface PluginThumbnailDeclaration {
  entryPoint: string;
}

export interface PluginFilePreviewDeclaration {
  extensions: string[];
  entryPoint: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export interface PluginHelpers {
  html: {
    fetchPage(url: string, options?: { headers?: Record<string, string>; cookies?: string }): Promise<string>;
    parse(html: string): import("cheerio").CheerioAPI;
    select(html: string, selector: string): string[];
    selectAttr(html: string, selector: string, attr: string): string[];
    selectHtml(html: string, selector: string): string[];
  };
  io: {
    downloadFile(url: string, outputPath: string, options?: { headers?: Record<string, string>; cookies?: string }): Promise<void>;
    downloadFiles(files: Array<{ url: string; outputPath: string }>, concurrency?: number, options?: { headers?: Record<string, string>; cookies?: string }): Promise<void>;
    ensureDir(dirPath: string): Promise<void>;
    fileExists(filePath: string): Promise<boolean>;
    moveFile(src: string, dest: string): Promise<void>;
    createZip(sourceDir: string, outputPath: string): Promise<void>;
    listFiles(dirPath: string, pattern?: RegExp): Promise<string[]>;
  };
  url: {
    extractBaseUrl(urlString: string): string;
    extractHostname(urlString: string): string;
    joinUrl(base: string, ...paths: string[]): string;
    resolveOutputDir(
      url: string,
      rootDirectory: string,
      defaultFolder: string,
      siteDirectoriesJson: string | null,
      logger: PluginLogger,
      options?: { subDir?: string }
    ): string;
  };
  string: {
    sanitizeFilename(input: string): string;
    removeNumbersAndSpaces(input: string): string;
    padNumber(num: number, length?: number): string;
    slugify(input: string): string;
    shellEscape(arg: string): string;
    xmlEscape(s: string): string;
    truncateTitle(title: string, maxLen: number): string;
    filenameFromUrl(url: string): string | null;
    getMimeExtension(mime: string): string;
    decodeHtmlEntities(str: string): string;
    buildFilename(text: string, ext: string, maxLen?: number): string;
  };
  process: {
    execAsync(cmd: string, options?: { cwd?: string; maxBuffer?: number; timeout?: number }): Promise<{ stdout: string; stderr: string }>;
  };
  nfo: {
    buildNfo(root: string, fields: Array<{ tag: string; value: string | number | boolean | null | undefined }>): string;
    NfoBuilder: new (root: string) => {
      add(tag: string, value: string | number | boolean | null | undefined): NfoBuilder;
      addIf(condition: boolean, tag: string, value: string | number | boolean | null | undefined): NfoBuilder;
      addRaw(line: string): NfoBuilder;
      section(tag: string, fields: Array<{ tag: string; value: string | number | boolean | null | undefined }>): NfoBuilder;
      build(): string;
    };
  };
  http: {
    createRateLimiter(options: {
      minIntervalMs: number;
      retryOnStatus?: number[];
      retryDelayMs?: number;
      maxRetries?: number;
    }): (url: string, options?: RequestInit & { logger?: PluginLogger }) => Promise<Response>;
  };
}

// Re-export NfoBuilder type for use in helpers.nfo declarations
type NfoBuilder = PluginHelpers["nfo"]["NfoBuilder"] extends new (...args: infer _A) => infer R ? R : never;
