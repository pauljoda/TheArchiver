"use client";

import { useState, useEffect } from "react";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif)$/i;
const cache = new Map<string, string | null>();

export function useFolderThumbnail(folderPath: string): string | null {
  const [url, setUrl] = useState<string | null>(cache.get(folderPath) ?? null);

  useEffect(() => {
    if (cache.has(folderPath)) {
      setUrl(cache.get(folderPath)!);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/files?path=${encodeURIComponent(folderPath)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((entries: FileEntry[]) => {
        const img = entries.find(
          (e) => !e.isDirectory && IMAGE_RE.test(e.name)
        );
        const result = img
          ? `/api/files/download?path=${encodeURIComponent(img.path)}`
          : null;
        cache.set(folderPath, result);
        setUrl(result);
      })
      .catch(() => {
        // Don't cache errors (including AbortError from unmount) — allow retry
      });

    return () => controller.abort();
  }, [folderPath]);

  return url;
}
