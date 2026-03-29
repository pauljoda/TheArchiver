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
