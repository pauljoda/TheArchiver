import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { sessions } from "../route";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INDEX_RE = /^\d+$/;

/**
 * GET /api/files/stream/segment?sessionId=<uuid>&index=<n>
 *
 * Serves an individual HLS .ts segment from a streaming session.
 * Polls briefly if the segment hasn't been written yet by ffmpeg.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const indexStr = request.nextUrl.searchParams.get("index");

    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json(
        { error: "Valid sessionId (UUID) is required" },
        { status: 400 }
      );
    }
    if (!indexStr || !INDEX_RE.test(indexStr)) {
      return NextResponse.json(
        { error: "Valid segment index is required" },
        { status: 400 }
      );
    }

    // Fast-fail if no active session exists (prevents DoS via fake session polling)
    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Update session last access time
    session.lastAccess = Date.now();

    const tempDir = path.join(os.tmpdir(), "archiver-hls", sessionId);
    const segmentPath = path.join(tempDir, `${indexStr}.ts`);

    // Poll for the segment file (ffmpeg may still be writing it)
    const found = await waitForSegment(segmentPath, 10_000);
    if (!found) {
      return NextResponse.json(
        { error: "Segment not available" },
        { status: 404 }
      );
    }

    // Brief wait to ensure ffmpeg has finished writing this segment
    await new Promise((r) => setTimeout(r, 100));

    const stat = await fsp.stat(segmentPath);
    const stream = fs.createReadStream(segmentPath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "video/mp2t",
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Error serving segment:", err);
    return NextResponse.json(
      { error: "Failed to serve segment" },
      { status: 500 }
    );
  }
}

async function waitForSegment(
  filePath: string,
  timeoutMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
}
