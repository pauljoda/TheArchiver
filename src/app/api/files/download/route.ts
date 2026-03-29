import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { resolveSafePath, FileError } from "@/lib/files";

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
        { error: "Cannot download a directory" },
        { status: 400 }
      );
    }

    const filename = path.basename(absolute);
    const stream = fs.createReadStream(absolute);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(stat.size),
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
    console.error("Error downloading file:", err);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
