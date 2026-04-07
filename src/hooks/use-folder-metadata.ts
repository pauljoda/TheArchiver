"use client";

import { useState, useEffect } from "react";

export interface PostCardMetadata {
  platform: "reddit" | "bluesky" | "twitter";
  title: string;
  author: string;
  score?: number;
  date?: string;
  commentCount?: number;
}

export type FolderPreview =
  | { type: "images"; urls: string[] }
  | { type: "text"; snippet: string }
  | { type: "names"; items: string[] }
  | { type: "empty" };

export interface FolderCardMetadata {
  post?: PostCardMetadata;
  preview: FolderPreview;
  itemCount: number;
}

const cache = new Map<string, FolderCardMetadata | null>();

/**
 * Fetches folder card metadata including Post.nfo data and preview images.
 * Replaces both useFolderThumbnail and the old useFolderMetadata with a single call.
 */
export function useFolderCardData(
  folderPath: string
): FolderCardMetadata | null {
  const [data, setData] = useState<FolderCardMetadata | null>(
    cache.get(folderPath) ?? null
  );

  useEffect(() => {
    if (!folderPath) return;

    if (cache.has(folderPath)) {
      setData(cache.get(folderPath)!);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/files/metadata?path=${encodeURIComponent(folderPath)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          cache.set(folderPath, null);
          return null;
        }
        return res.json();
      })
      .then((result: FolderCardMetadata | null) => {
        cache.set(folderPath, result);
        setData(result);
      })
      .catch(() => {
        // Don't cache errors — allow retry
      });

    return () => controller.abort();
  }, [folderPath]);

  return data;
}

