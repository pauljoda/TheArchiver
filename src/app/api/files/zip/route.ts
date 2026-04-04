import { NextRequest, NextResponse } from "next/server";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";
import { Readable } from "stream";
import { resolveSafePath, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

function createZipResponse(archive: archiver.Archiver, filename: string) {
  const passthrough = new PassThrough();

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    passthrough.destroy(err);
  });
  archive.pipe(passthrough);

  const webStream = Readable.toWeb(passthrough) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.zip"`,
      "Transfer-Encoding": "chunked",
    },
  });
}

/** GET /api/files/zip?path=some/dir — zip a single directory */
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
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const dirName = path.basename(absolute);
    const archive = archiver("zip", { zlib: { level: 5 } });

    archive.directory(absolute, false);
    archive.finalize();

    return createZipResponse(archive, dirName);
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
    console.error("Error creating zip:", err);
    return NextResponse.json(
      { error: "Failed to create zip" },
      { status: 500 }
    );
  }
}

/** POST /api/files/zip — zip multiple selected files/directories */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paths: string[] = body.paths;

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: "paths array is required" },
        { status: 400 }
      );
    }

    const archive = archiver("zip", { zlib: { level: 5 } });

    for (const relativePath of paths) {
      const { absolute } = resolveSafePath(relativePath);
      const stat = await fsp.stat(absolute);
      const name = path.basename(absolute);

      if (stat.isDirectory()) {
        archive.directory(absolute, name);
      } else {
        archive.file(absolute, { name });
      }
    }

    archive.finalize();

    return createZipResponse(archive, "download");
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
    console.error("Error creating zip:", err);
    return NextResponse.json(
      { error: "Failed to create zip" },
      { status: 500 }
    );
  }
}
