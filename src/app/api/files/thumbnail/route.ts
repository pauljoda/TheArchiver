import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { resolveSafePath, FileError } from "@/lib/files";
import { VIDEO_EXTS } from "@/lib/file-preview";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const THUMB_DIR = ".thumbs";
const THUMB_QUALITY = "5"; // ffmpeg JPEG quality (2-31, lower = better)

/**
 * GET /api/files/thumbnail?path=some/video.mkv
 *
 * Extracts a single frame from a video file using ffmpeg and returns it as JPEG.
 * Thumbnails are cached in a .thumbs directory next to the video file.
 */
export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path");
    if (!relativePath) {
      return NextResponse.json(
        { error: "Path query parameter is required" },
        { status: 400 }
      );
    }

    const { absolute } = resolveSafePath(relativePath);
    const stat = await fsp.stat(absolute);

    if (stat.isDirectory()) {
      return NextResponse.json(
        { error: "Cannot thumbnail a directory" },
        { status: 400 }
      );
    }

    const ext = path.extname(absolute).replace(".", "").toLowerCase();
    if (!VIDEO_EXTS.has(ext)) {
      return NextResponse.json(
        { error: "Not a video file" },
        { status: 400 }
      );
    }

    // Build cache path: <parent>/.thumbs/<filename>.jpg
    const parentDir = path.dirname(absolute);
    const thumbDir = path.join(parentDir, THUMB_DIR);
    const thumbName = path.basename(absolute, path.extname(absolute)) + ".jpg";
    const thumbPath = path.join(thumbDir, thumbName);

    // Check cache — if thumb exists and video hasn't changed, serve it
    let needGenerate = true;
    try {
      const thumbStat = await fsp.stat(thumbPath);
      if (thumbStat.mtimeMs >= stat.mtimeMs) {
        needGenerate = false;
      }
    } catch {
      // Thumb doesn't exist yet
    }

    if (needGenerate) {
      await fsp.mkdir(thumbDir, { recursive: true });

      try {
        await execFileAsync("ffmpeg", [
          "-ss", "1",          // seek to 1 second
          "-i", absolute,
          "-frames:v", "1",    // extract one frame
          "-q:v", THUMB_QUALITY,
          "-vf", "scale=480:-2", // 480px wide, keep aspect ratio
          "-y",                // overwrite
          thumbPath,
        ], { timeout: 15000 });
      } catch {
        // If seeking to 1s fails (very short video), try frame 0
        try {
          await execFileAsync("ffmpeg", [
            "-i", absolute,
            "-frames:v", "1",
            "-q:v", THUMB_QUALITY,
            "-vf", "scale=480:-2",
            "-y",
            thumbPath,
          ], { timeout: 15000 });
        } catch (err) {
          console.error("ffmpeg thumbnail failed:", err);
          return NextResponse.json(
            { error: "Failed to generate thumbnail" },
            { status: 500 }
          );
        }
      }
    }

    // Serve the cached thumbnail
    const thumbData = fs.createReadStream(thumbPath);
    const { Readable } = await import("stream");
    const webStream = Readable.toWeb(thumbData) as ReadableStream;
    const thumbStat = await fsp.stat(thumbPath);

    return new Response(webStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(thumbStat.size),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof FileError) {
      const status =
        err.code === "TRAVERSAL"
          ? 403
          : err.code === "NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Error generating thumbnail:", err);
    return NextResponse.json(
      { error: "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}
