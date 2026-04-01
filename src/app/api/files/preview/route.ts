import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { resolveSafePath, getMimeType, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

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
        { error: "Cannot preview a directory" },
        { status: 400 }
      );
    }

    const filename = path.basename(absolute);
    const mimeType = getMimeType(filename);
    const fileSize = stat.size;

    // Optional maxBytes for text truncation
    const maxBytesParam = request.nextUrl.searchParams.get("maxBytes");
    const maxBytes = maxBytesParam ? parseInt(maxBytesParam, 10) : null;

    // Handle Range requests for video/audio seeking
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(absolute, { start, end });
        const webStream = Readable.toWeb(stream) as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          },
        });
      }
    }

    // Full file response (with optional truncation for text)
    const isText = mimeType.startsWith("text/") || mimeType === "application/json";
    const shouldTruncate = isText && maxBytes && fileSize > maxBytes;

    const streamOptions = shouldTruncate
      ? { start: 0, end: maxBytes! - 1 }
      : undefined;
    const stream = fs.createReadStream(absolute, streamOptions);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": isText ? `${mimeType}; charset=utf-8` : mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(shouldTruncate ? maxBytes! : fileSize),
    };

    // Tell the client whether the file was truncated and the full size
    if (shouldTruncate) {
      headers["X-Truncated"] = "true";
      headers["X-Full-Size"] = String(fileSize);
    }

    return new Response(webStream, { headers });
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
    console.error("Error previewing file:", err);
    return NextResponse.json(
      { error: "Failed to preview file" },
      { status: 500 }
    );
  }
}
