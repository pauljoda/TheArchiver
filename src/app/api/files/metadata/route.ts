import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

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
      title: text ? text.slice(0, 100) + (text.length > 100 ? "..." : "") : "Post",
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
      title: text ? text.slice(0, 100) + (text.length > 100 ? "..." : "") : "Tweet",
      author: parseXmlText(xml, "screen_name") || "unknown",
      score: parseXmlInt(xml, "favorite_count"),
      date: parseXmlText(xml, "created") || undefined,
      commentCount: parseXmlInt(xml, "reply_count"),
    };
  }

  return null;
}

/**
 * GET /api/files/metadata?path=some/folder
 *
 * Reads Post.nfo from the given directory (if it exists) and returns
 * normalized card metadata. Returns 204 if no Post.nfo found.
 */
export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path") || "";
    const { absolute } = resolveSafePath(relativePath);

    const nfoPath = path.join(absolute, "Post.nfo");

    try {
      const content = await fs.readFile(nfoPath, "utf-8");
      const metadata = parseNfo(content);
      if (!metadata) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(metadata);
    } catch {
      // Post.nfo doesn't exist
      return new NextResponse(null, { status: 204 });
    }
  } catch (err) {
    if (err instanceof FileError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to read metadata" }, { status: 500 });
  }
}
