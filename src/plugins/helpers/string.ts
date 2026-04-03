import path from "path";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeFilename(input: string): string {
  return input.replace(INVALID_FILENAME_CHARS, "").trim();
}

export function removeNumbersAndSpaces(input: string): string {
  return input.replace(/[\d\s]/g, "");
}

export function padNumber(num: number, length: number = 3): string {
  return String(num).padStart(length, "0");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** POSIX single-quote escape for safe shell argument injection. */
export function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/** Escape the five XML special characters for safe text content. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate a title string and strip trailing separator characters. */
export function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen).replace(/[-_\s]+$/, "");
}

/** Extract a filename with extension from a URL, or null if none found. */
export function filenameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const base = path.basename(pathname);
    return base && path.extname(base) ? base : null;
  } catch {
    return null;
  }
}

/** Map a MIME type string to a file extension. Defaults to "jpg". */
export function getMimeExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpg": "jpg",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/tiff": "tiff",
  };
  return map[mime.toLowerCase()] || "jpg";
}
