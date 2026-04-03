import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath, getRelativePath, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif)$/i;
const MAX_PREVIEW_IMAGES = 4;
const MAX_PEEK_DIRS = 5;
const MAX_NAME_ITEMS = 8;

/**
 * Normalized post metadata returned for any platform.
 */
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

function parseXmlText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "s"));
  return match?.[1]?.trim() || "";
}

function parseXmlInt(xml: string, tag: string): number | undefined {
  const val = parseXmlText(xml, tag);
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

function parseNfo(xml: string): PostCardMetadata | null {
  if (xml.includes("<postdetails>")) {
    return {
      platform: "reddit",
      title: parseXmlText(xml, "title") || "Untitled",
      author: parseXmlText(xml, "author") || "[deleted]",
      score: parseXmlInt(xml, "score"),
      date: parseXmlText(xml, "created") || undefined,
      commentCount: parseXmlInt(xml, "num_comments"),
    };
  }

  if (xml.includes("<blueskypost>")) {
    const text = parseXmlText(xml, "text");
    return {
      platform: "bluesky",
      title: text
        ? text.slice(0, 100) + (text.length > 100 ? "..." : "")
        : "Post",
      author: parseXmlText(xml, "handle") || "unknown",
      score: parseXmlInt(xml, "like_count"),
      date: parseXmlText(xml, "created") || undefined,
      commentCount: parseXmlInt(xml, "reply_count"),
    };
  }

  if (xml.includes("<twitterpost>")) {
    const text = parseXmlText(xml, "text");
    return {
      platform: "twitter",
      title: text
        ? text.slice(0, 100) + (text.length > 100 ? "..." : "")
        : "Tweet",
      author: parseXmlText(xml, "screen_name") || "unknown",
      score: parseXmlInt(xml, "favorite_count"),
      date: parseXmlText(xml, "created") || undefined,
      commentCount: parseXmlInt(xml, "reply_count"),
    };
  }

  return null;
}

/** Find up to N image files in a directory (non-recursive, skips hidden). */
async function findImages(
  dirPath: string,
  root: string,
  max: number
): Promise<string[]> {
  try {
    const entries: import("fs").Dirent[] = await fs.readdir(dirPath, { withFileTypes: true });
    const images: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory() && IMAGE_RE.test(entry.name)) {
        const rel = getRelativePath(path.join(dirPath, entry.name), root);
        images.push(
          `/api/files/download?path=${encodeURIComponent(rel)}`
        );
        if (images.length >= max) break;
      }
    }
    return images;
  } catch {
    return [];
  }
}

/** Build folder preview by scanning children. */
async function buildPreview(
  absolute: string,
  root: string,
  post: PostCardMetadata | null
): Promise<{ preview: FolderPreview; itemCount: number }> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch {
    return { preview: { type: "empty" }, itemCount: 0 };
  }

  const visible = entries.filter((e) => !e.name.startsWith("."));
  const dirs = visible.filter((e) => e.isDirectory());
  const files = visible.filter((e) => !e.isDirectory());
  const itemCount = visible.length;

  // Check for direct images in this folder
  const directImages = files
    .filter((f) => IMAGE_RE.test(f.name))
    .slice(0, MAX_PREVIEW_IMAGES)
    .map((f) => {
      const rel = getRelativePath(path.join(absolute, f.name), root);
      return `/api/files/download?path=${encodeURIComponent(rel)}`;
    });

  if (directImages.length > 0) {
    return { preview: { type: "images", urls: directImages }, itemCount };
  }

  // If children are directories, peek into first few for images
  if (dirs.length > 0) {
    const collageImages: string[] = [];
    for (const dir of dirs.slice(0, MAX_PEEK_DIRS)) {
      const childPath = path.join(absolute, dir.name);
      const found = await findImages(
        childPath,
        root,
        MAX_PREVIEW_IMAGES - collageImages.length
      );
      collageImages.push(...found);
      if (collageImages.length >= MAX_PREVIEW_IMAGES) break;
    }

    if (collageImages.length > 0) {
      return {
        preview: { type: "images", urls: collageImages.slice(0, MAX_PREVIEW_IMAGES) },
        itemCount,
      };
    }

    // No images found — show directory names as pills
    return {
      preview: {
        type: "names",
        items: dirs.slice(0, MAX_NAME_ITEMS).map((d) => d.name),
      },
      itemCount,
    };
  }

  // Text-only post (Post.nfo exists but no media)
  if (post) {
    const snippet =
      post.title.length > 80
        ? post.title.slice(0, 80) + "..."
        : post.title;
    return { preview: { type: "text", snippet }, itemCount };
  }

  return { preview: { type: "empty" }, itemCount };
}

/**
 * GET /api/files/metadata?path=some/folder
 *
 * Returns folder card metadata including Post.nfo data (if present)
 * and preview thumbnail data for the card grid.
 */
export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path") || "";
    const { absolute, root } = resolveSafePath(relativePath);

    // Read Post.nfo if it exists
    let post: PostCardMetadata | null = null;
    const nfoPath = path.join(absolute, "Post.nfo");
    try {
      const content = await fs.readFile(nfoPath, "utf-8");
      post = parseNfo(content);
    } catch {
      // No Post.nfo — that's fine
    }

    // Build preview
    const { preview, itemCount } = await buildPreview(absolute, root, post);

    const result: FolderCardMetadata = {
      preview,
      itemCount,
    };
    if (post) {
      result.post = post;
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FileError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to read metadata" },
      { status: 500 }
    );
  }
}
