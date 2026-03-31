import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  resolveSafePath,
  resolveSafeNewPath,
  getRelativePath,
  FileError,
} from "@/lib/files";

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

// Create folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path: targetPath } = body;

    if (action !== "mkdir" || !targetPath) {
      return NextResponse.json(
        { error: "Invalid action or missing path" },
        { status: 400 }
      );
    }

    const { absolute } = resolveSafeNewPath(targetPath);
    await fs.mkdir(absolute);

    return NextResponse.json({ success: true, created: targetPath });
  } catch (err) {
    if (err instanceof FileError) {
      const status =
        err.code === "TRAVERSAL"
          ? 403
          : err.code === "NOT_FOUND"
            ? 404
            : err.message === "Path already exists"
              ? 409
              : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Error creating folder:", err);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}

// Rename file or folder
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path: sourcePath, newName } = body;

    if (action !== "rename" || !sourcePath || !newName) {
      return NextResponse.json(
        { error: "Invalid action or missing fields" },
        { status: 400 }
      );
    }

    // newName must be a bare filename — no path separators
    if (newName.includes("/") || newName.includes("\\")) {
      return NextResponse.json(
        { error: "New name must not contain path separators" },
        { status: 400 }
      );
    }

    const { absolute: sourceAbsolute, root } = resolveSafePath(sourcePath);
    const parentDir = path.dirname(sourcePath);
    const newRelativePath = parentDir ? `${parentDir}/${newName}` : newName;
    const { absolute: targetAbsolute } = resolveSafeNewPath(newRelativePath);

    await fs.rename(sourceAbsolute, targetAbsolute);

    return NextResponse.json({
      success: true,
      oldPath: sourcePath,
      newPath: newRelativePath,
    });
  } catch (err) {
    if (err instanceof FileError) {
      const status =
        err.code === "TRAVERSAL"
          ? 403
          : err.code === "NOT_FOUND"
            ? 404
            : err.message === "Path already exists"
              ? 409
              : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Error renaming:", err);
    return NextResponse.json(
      { error: "Failed to rename" },
      { status: 500 }
    );
  }
}

// Move or copy files/folders
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      paths,
      destination,
    }: { action: string; paths: string[]; destination: string } = body;

    if (
      (action !== "move" && action !== "copy") ||
      !Array.isArray(paths) ||
      paths.length === 0 ||
      !destination
    ) {
      return NextResponse.json(
        { error: "Invalid action, paths, or destination" },
        { status: 400 }
      );
    }

    const { absolute: destAbsolute } = resolveSafePath(destination);
    const destStat = await fs.stat(destAbsolute);
    if (!destStat.isDirectory()) {
      return NextResponse.json(
        { error: "Destination is not a directory" },
        { status: 400 }
      );
    }

    const completed: string[] = [];
    for (const sourcePath of paths) {
      const { absolute: sourceAbsolute, root } = resolveSafePath(sourcePath);
      const basename = path.basename(sourceAbsolute);
      const targetAbsolute = path.join(destAbsolute, basename);

      // Containment check — prevent moving folder into itself or descendant
      const realSource = await fs.realpath(sourceAbsolute);
      if (
        targetAbsolute === realSource ||
        targetAbsolute.startsWith(realSource + path.sep)
      ) {
        return NextResponse.json(
          {
            error: "Cannot move a folder into itself or a descendant",
            completed,
            failed: sourcePath,
          },
          { status: 400 }
        );
      }

      // Check target doesn't already exist
      try {
        await fs.access(targetAbsolute);
        return NextResponse.json(
          {
            error: `Already exists: ${basename}`,
            completed,
            failed: sourcePath,
          },
          { status: 409 }
        );
      } catch {
        // Good — target doesn't exist
      }

      if (action === "move") {
        await fs.rename(sourceAbsolute, targetAbsolute);
      } else {
        await fs.cp(sourceAbsolute, targetAbsolute, { recursive: true });
      }
      completed.push(sourcePath);
    }

    return NextResponse.json({
      success: true,
      action,
      count: completed.length,
      destination,
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
    console.error("Error in move/copy:", err);
    return NextResponse.json(
      { error: "Failed to move/copy" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const paths: string[] = body.paths || (body.path ? [body.path] : []);

    if (paths.length === 0) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    const deleted: string[] = [];
    for (const relativePath of paths) {
      const { absolute, root } = resolveSafePath(relativePath);

      if (absolute === root) {
        return NextResponse.json(
          { error: "Cannot delete the root download directory" },
          { status: 403 }
        );
      }

      await fs.rm(absolute, { recursive: true, force: true });
      deleted.push(relativePath);
    }

    return NextResponse.json({
      success: true,
      deleted: deleted.length === 1 ? deleted[0] : deleted,
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
    console.error("Error deleting file:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
