export type PreviewType = "image" | "video" | "audio" | "text" | "pdf" | "generic";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "tiff"]);
export const VIDEO_EXTS = new Set(["mp4", "m4v", "mkv", "avi", "mov", "webm", "flv", "wmv"]);
const AUDIO_EXTS = new Set(["mp3", "flac", "wav", "ogg", "aac", "wma", "m4a"]);
const TEXT_EXTS = new Set([
  "txt", "md", "json", "xml", "html", "css", "js", "ts", "jsx", "tsx",
  "py", "sh", "yaml", "yml", "toml", "ini", "cfg", "log", "csv", "env",
  "gitignore", "dockerignore", "editorconfig", "nfo",
]);

/** Browser-native video formats that <video> can play. */
export const NATIVE_VIDEO_EXTS = new Set(["mp4", "m4v", "webm", "mov", "ogg"]);

/** Determine the preview renderer type for a filename. */
export function getPreviewType(filename: string): PreviewType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (TEXT_EXTS.has(ext)) return "text";
  return "generic";
}

/** Build the preview URL for a file path. */
export function previewUrl(filePath: string, maxBytes?: number): string {
  const url = `/api/files/preview?path=${encodeURIComponent(filePath)}`;
  return maxBytes ? `${url}&maxBytes=${maxBytes}` : url;
}
