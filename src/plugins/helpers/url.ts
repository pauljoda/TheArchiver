export function extractBaseUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.origin;
  } catch {
    return urlString;
  }
}

export function extractHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return urlString;
  }
}

export function joinUrl(base: string, ...paths: string[]): string {
  let result = base.replace(/\/+$/, "");
  for (const p of paths) {
    result += "/" + p.replace(/^\/+/, "");
  }
  return result;
}

interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
}

/**
 * Resolve the output directory for a download URL using optional per-site
 * directory overrides from a site-directory-map setting.
 *
 * @param prependDefaultFolder When true (default), the defaultFolder is
 *   prepended to matched paths that don't already start with it. Set to
 *   false when the matched folder should be used as-is relative to rootDirectory.
 */
export function resolveOutputDir(
  url: string,
  rootDirectory: string,
  defaultFolder: string,
  siteDirectoriesJson: string | undefined | null,
  logger: Logger,
  options?: { prependDefaultFolder?: boolean }
): string {
  const path = require("path") as typeof import("path");
  const baseOutputDir = path.join(rootDirectory, defaultFolder);
  const prepend = options?.prependDefaultFolder ?? true;

  if (!siteDirectoriesJson) return baseOutputDir;

  let siteMap: Record<string, string>;
  try {
    siteMap = JSON.parse(siteDirectoriesJson);
  } catch {
    logger.warn(
      "site_directories setting is not valid JSON, using default folder"
    );
    return baseOutputDir;
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return baseOutputDir;
  }

  for (const [domain, folder] of Object.entries(siteMap)) {
    if (hostname === domain || hostname.endsWith("." + domain)) {
      const segments = folder.split(/[\\/]+/).filter(Boolean);
      if (segments.length === 0) return baseOutputDir;

      if (prepend && segments[0] !== defaultFolder) {
        const resolvedPath = path.join(
          rootDirectory,
          defaultFolder,
          ...segments
        );
        logger.info(
          `Site directory override: ${domain} -> ${defaultFolder}/${segments.join("/")}`
        );
        return resolvedPath;
      }

      const resolvedPath = path.join(rootDirectory, ...segments);
      logger.info(`Site directory override: ${domain} -> ${segments.join("/")}`);
      return resolvedPath;
    }
  }

  return baseOutputDir;
}
