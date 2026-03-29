import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath, getRelativePath, FileError } from "@/lib/files";

export const dynamic = "force-dynamic";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path") || "";
    const { absolute, root } = resolveSafePath(relativePath);

    const stat = await fs.stat(absolute);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const entries = await fs.readdir(absolute, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith(".")) continue;

      const entryPath = path.join(absolute, entry.name);
      try {
        const entryStat = await fs.stat(entryPath);
        results.push({
          name: entry.name,
          path: getRelativePath(entryPath, root),
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : entryStat.size,
          modifiedAt: entryStat.mtime.toISOString(),
        });
      } catch {
        // Skip entries we can't stat (broken symlinks, permission issues)
        continue;
      }
    }

    // Sort: directories first, then alphabetically
    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return NextResponse.json(results);
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
    console.error("Error listing files:", err);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const relativePath: string = body.path;

    if (!relativePath) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    const { absolute, root } = resolveSafePath(relativePath);

    // Refuse to delete the root directory itself
    if (absolute === root) {
      return NextResponse.json(
        { error: "Cannot delete the root download directory" },
        { status: 403 }
      );
    }

    await fs.rm(absolute, { recursive: true, force: true });

    return NextResponse.json({ success: true, deleted: relativePath });
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
    console.error("Error deleting file:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
