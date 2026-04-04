import { NextRequest, NextResponse } from "next/server";
import { spawn, execFile, type ChildProcess } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { resolveSafePath, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

// ── Session management ──

interface StreamSession {
  process: ChildProcess;
  tempDir: string;
  sourcePath: string;
  lastAccess: number;
  duration: number;
  seekOffset: number;
  codec: "copy" | "transcode";
}

// Exported for use by the segment route to validate session existence
export const sessions = new Map<string, StreamSession>();

const SESSION_TIMEOUT_MS = 60_000; // 1 minute idle timeout
const CLEANUP_INTERVAL_MS = 30_000;
const HLS_SEGMENT_DURATION = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Periodic cleanup of idle sessions
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastAccess > SESSION_TIMEOUT_MS) {
        destroySession(id);
      }
    }
    if (sessions.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

function destroySession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    session.process.kill("SIGKILL");
  } catch {
    // Process may have already exited
  }

  // Clean up temp directory
  try {
    fs.rmSync(session.tempDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }

  sessions.delete(sessionId);
}

// ── Codec detection via ffprobe ──

interface ProbeResult {
  videoCodec: string;
  audioCodec: string;
  duration: number;
}

async function probeFile(absolutePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    absolutePath,
  ], { timeout: 10_000 });

  const data = JSON.parse(stdout);
  const streams = data.streams || [];
  const videoStream = streams.find((s: Record<string, string>) => s.codec_type === "video");
  const audioStream = streams.find((s: Record<string, string>) => s.codec_type === "audio");
  const duration = parseFloat(data.format?.duration || "0");

  return {
    videoCodec: videoStream?.codec_name || "unknown",
    audioCodec: audioStream?.codec_name || "unknown",
    duration,
  };
}

/**
 * Check if codecs are compatible for HLS stream copy (no re-encode).
 * HLS requires H.264/H.265 video and AAC audio for broad browser support.
 */
function canStreamCopy(probe: ProbeResult): boolean {
  const videoOk = ["h264", "hevc", "h265"].includes(probe.videoCodec);
  const audioOk = ["aac", "mp4a"].includes(probe.audioCodec);
  return videoOk && audioOk;
}

// ── Route handler ──

/**
 * GET /api/files/stream?path=<relative>&sessionId=<uuid>&seek=<seconds>
 *
 * Returns an HLS .m3u8 playlist for streaming any video file.
 * Spawns ffmpeg to produce HLS segments in a temp directory.
 * If the video is h264+aac, uses stream copy (instant, no CPU).
 * Otherwise transcodes to h264+aac.
 *
 * Reusable by any plugin — not YouTube-specific.
 */
export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const seekStr = request.nextUrl.searchParams.get("seek") || "0";
    const seek = Math.max(0, parseFloat(seekStr) || 0);

    if (!relativePath) {
      return NextResponse.json(
        { error: "path parameter is required" },
        { status: 400 }
      );
    }
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json(
        { error: "Valid sessionId (UUID) is required" },
        { status: 400 }
      );
    }

    const { absolute } = resolveSafePath(relativePath);

    // Kill existing session if seeking or re-requesting
    if (sessions.has(sessionId)) {
      destroySession(sessionId);
    }

    // Probe the file for codec info and duration
    const probe = await probeFile(absolute);
    const useCopy = canStreamCopy(probe);
    const duration = probe.duration;

    // Create temp directory for HLS segments
    const tempDir = path.join(os.tmpdir(), "archiver-hls", sessionId);
    await fsp.mkdir(tempDir, { recursive: true });

    const playlistPath = path.join(tempDir, "playlist.m3u8");
    const segmentPattern = path.join(tempDir, "%d.ts");

    // Build ffmpeg args
    const ffmpegArgs: string[] = [];

    if (seek > 0) {
      ffmpegArgs.push("-ss", String(seek));
    }

    ffmpegArgs.push("-i", absolute);

    if (useCopy) {
      // Stream copy — near-instant, no quality loss
      ffmpegArgs.push("-c:v", "copy", "-c:a", "copy");
    } else {
      // Transcode to h264+aac for browser compatibility
      ffmpegArgs.push(
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k"
      );
    }

    ffmpegArgs.push(
      "-f", "hls",
      "-hls_time", String(HLS_SEGMENT_DURATION),
      "-hls_list_size", "0",        // Keep all segments in playlist
      "-hls_segment_filename", segmentPattern,
      "-hls_flags", "independent_segments",
      "-y",
      playlistPath
    );

    const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const session: StreamSession = {
      process: ffmpeg,
      tempDir,
      sourcePath: absolute,
      lastAccess: Date.now(),
      duration,
      seekOffset: seek,
      codec: useCopy ? "copy" : "transcode",
    };
    sessions.set(sessionId, session);
    ensureCleanup();

    // Wait for playlist with at least one segment reference (up to 15s)
    const rawPlaylist = await waitForPlaylistReady(playlistPath, 15_000);
    if (!rawPlaylist) {
      destroySession(sessionId);
      return NextResponse.json(
        { error: "Failed to start stream — ffmpeg did not produce output" },
        { status: 500 }
      );
    }
    const rewrittenPlaylist = rewritePlaylist(rawPlaylist, sessionId);

    return new Response(rewrittenPlaylist, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    if (err instanceof FileError) {
      const status =
        err.code === "TRAVERSAL" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Error starting stream:", err);
    return NextResponse.json(
      { error: "Failed to start stream" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/files/stream?sessionId=<uuid>
 *
 * Explicitly destroy a streaming session and its ffmpeg process.
 * Called by the client when navigating away from a video.
 */
export async function DELETE(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json(
      { error: "Valid sessionId (UUID) is required" },
      { status: 400 }
    );
  }

  destroySession(sessionId);
  return new Response(null, { status: 204 });
}

// ── Helpers ──

/**
 * Rewrite segment paths in the m3u8 to point to our segment API route.
 * Handles both relative filenames (0.ts) and absolute paths from ffmpeg.
 */
function rewritePlaylist(raw: string, sessionId: string): string {
  return raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      // Skip HLS tags and empty lines
      if (trimmed.startsWith("#") || trimmed === "") return line;
      // Extract just the segment number from the filename
      const match = trimmed.match(/(\d+)\.ts$/);
      if (match) {
        return `/api/files/stream/segment?sessionId=${sessionId}&index=${match[1]}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * Poll until the playlist file exists AND contains at least one .ts segment reference.
 * Returns the playlist content when ready, or null on timeout.
 */
async function waitForPlaylistReady(
  filePath: string,
  timeoutMs: number
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const content = await fsp.readFile(filePath, "utf-8");
      // Check for at least one segment entry (a line ending in .ts)
      if (/\d+\.ts/m.test(content)) {
        return content;
      }
    } catch {
      // File doesn't exist yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}
