import path from "path";
import fs from "fs";
import { getSetting } from "./settings";

export class FileError extends Error {
  code: "TRAVERSAL" | "NOT_FOUND" | "PERMISSION" | "INVALID";

  constructor(
    message: string,
    code: "TRAVERSAL" | "NOT_FOUND" | "PERMISSION" | "INVALID"
  ) {
    super(message);
    this.code = code;
  }
}

/**
 * Resolves a user-supplied relative path against the download root directory.
 * Prevents path traversal, null byte injection, and symlink escapes.
 * Returns the absolute path and the resolved root.
 */
export function resolveSafePath(relativePath: string): {
  absolute: string;
  root: string;
} {
  // Get the download root directory
  const root = path.resolve(
    getSetting<string>("core.download_location") || "./downloads"
  );

  // Reject null bytes
  if (relativePath.includes("\0")) {
    throw new FileError("Invalid path", "INVALID");
  }

  // Normalize separators and reject .. segments
  const normalized = relativePath.replace(/\\/g, "/");
  if (
    normalized.split("/").some((seg) => seg === ".." || seg === ".")
  ) {
    throw new FileError("Path traversal not allowed", "TRAVERSAL");
  }

  // Resolve the full path
  const resolved = path.resolve(root, normalized);

  // Verify the resolved path is within or equal to root
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new FileError("Path traversal not allowed", "TRAVERSAL");
  }

  // Check existence
  if (!fs.existsSync(resolved)) {
    throw new FileError("Path not found", "NOT_FOUND");
  }

  // Check for symlink escapes — resolve real path and verify still inside root
  const realPath = fs.realpathSync(resolved);
  const realRoot = fs.realpathSync(root);
  if (realPath !== realRoot && !realPath.startsWith(realRoot + path.sep)) {
    throw new FileError("Path traversal not allowed", "TRAVERSAL");
  }

  return { absolute: realPath, root: realRoot };
}

/**
 * Like resolveSafePath, but for paths that don't exist yet (create, rename, move targets).
 * Validates the parent directory exists and the target does NOT already exist.
 */
export function resolveSafeNewPath(relativePath: string): {
  absolute: string;
  root: string;
  parentAbsolute: string;
} {
  const root = path.resolve(
    getSetting<string>("core.download_location") || "./downloads"
  );

  if (relativePath.includes("\0")) {
    throw new FileError("Invalid path", "INVALID");
  }

  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.split("/").some((seg) => seg === ".." || seg === ".")) {
    throw new FileError("Path traversal not allowed", "TRAVERSAL");
  }

  const resolved = path.resolve(root, normalized);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new FileError("Path traversal not allowed", "TRAVERSAL");
  }

  // Verify parent directory exists
  const parentDir = path.dirname(resolved);
  const parentRelative = getRelativePath(parentDir, root) || "";
  // This validates the parent exists and is within root
  const { absolute: parentAbsolute } = resolveSafePath(
    parentRelative || ""
  );

  // Target must NOT already exist
  if (fs.existsSync(resolved)) {
    throw new FileError("Path already exists", "INVALID");
  }

  return { absolute: resolved, root, parentAbsolute };
}

/** Get the relative path from the download root. */
export function getRelativePath(absolute: string, root: string): string {
  if (absolute === root) return "";
  return absolute.slice(root.length + 1);
}

/** Map a filename to its MIME type for inline preview. */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    ".tiff": "image/tiff",
    // Video
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    // Audio
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".wma": "audio/x-ms-wma",
    ".m4a": "audio/mp4",
    // PDF
    ".pdf": "application/pdf",
    // Text / code
    ".txt": "text/plain",
    ".md": "text/plain",
    ".json": "application/json",
    ".xml": "text/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".ts": "text/plain",
    ".jsx": "text/plain",
    ".tsx": "text/plain",
    ".py": "text/plain",
    ".sh": "text/plain",
    ".yaml": "text/plain",
    ".yml": "text/plain",
    ".toml": "text/plain",
    ".ini": "text/plain",
    ".cfg": "text/plain",
    ".log": "text/plain",
    ".csv": "text/csv",
    ".env": "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

/** Get an appropriate file type category from extension. */
export function getFileCategory(
  filename: string
): "image" | "video" | "audio" | "archive" | "document" | "file" {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"].includes(ext))
    return "image";
  if ([".mp4", ".m4v", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"].includes(ext))
    return "video";
  if ([".mp3", ".flac", ".wav", ".ogg", ".aac", ".wma", ".m4a"].includes(ext))
    return "audio";
  if ([".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz"].includes(ext))
    return "archive";
  if ([".pdf", ".doc", ".docx", ".txt", ".md", ".epub", ".cbz", ".cbr"].includes(ext))
    return "document";
  return "file";
}
