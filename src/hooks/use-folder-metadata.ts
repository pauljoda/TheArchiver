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

const cache = new Map<string, PostCardMetadata | null>();

/**
 * Fetches Post.nfo metadata for a folder if it exists.
 * Returns null if the folder has no Post.nfo or hasn't loaded yet.
 */
export function useFolderMetadata(folderPath: string): PostCardMetadata | null {
  const [meta, setMeta] = useState<PostCardMetadata | null>(
    cache.get(folderPath) ?? null
  );

  useEffect(() => {
    if (cache.has(folderPath)) {
      setMeta(cache.get(folderPath)!);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/files/metadata?path=${encodeURIComponent(folderPath)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 204 || !res.ok) {
          cache.set(folderPath, null);
          return null;
        }
        return res.json();
      })
      .then((data: PostCardMetadata | null) => {
        cache.set(folderPath, data);
        setMeta(data);
      })
      .catch(() => {
        // Don't cache errors — allow retry
      });

    return () => controller.abort();
  }, [folderPath]);

  return meta;
}
