import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getSetting, setSetting } from "@/lib/settings";

const PLUGINS_DIR =
  process.env.PLUGINS_DIR || path.resolve(process.cwd(), "plugins");

function isValidSegment(s: string): boolean {
  return s.length > 0 && !s.includes("\0") && s !== "." && s !== "..";
}

function validateCookiesFile(content: string): {
  valid: boolean;
  error?: string;
} {
  const lines = content.split(/\r?\n/);

  // Check for Netscape header in the first 5 lines
  let hasHeader = false;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (/Netscape HTTP Cookie File|HTTP Cookie File/.test(lines[i])) {
      hasHeader = true;
      break;
    }
  }

  if (!hasHeader) {
    return {
      valid: false,
      error:
        'Invalid cookies file: missing "# Netscape HTTP Cookie File" header. ' +
        "Make sure you exported cookies using a browser extension that produces Netscape-format cookies.txt.",
    };
  }

  // Verify at least one valid data line (7 tab-separated fields)
  let hasDataLine = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const fields = trimmed.split("\t");
    if (fields.length >= 7) {
      hasDataLine = true;
      break;
    }
  }

  if (!hasDataLine) {
    return {
      valid: false,
      error:
        "Invalid cookies file: no valid cookie entries found. " +
        "Each line should have 7 tab-separated fields (domain, flag, path, secure, expiration, name, value).",
    };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pluginId = formData.get("pluginId") as string | null;
    const settingKey = formData.get("settingKey") as string | null;
    const file = formData.get("file") as File | null;

    if (!pluginId || !settingKey || !file) {
      return NextResponse.json(
        { error: "pluginId, settingKey, and file are required" },
        { status: 400 }
      );
    }

    if (!isValidSegment(pluginId) || !isValidSegment(settingKey)) {
      return NextResponse.json(
        { error: "Invalid pluginId or settingKey" },
        { status: 400 }
      );
    }

    // Verify plugin exists
    const db = getDb();
    const plugin = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, pluginId))
      .get();

    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin "${pluginId}" not found` },
        { status: 404 }
      );
    }

    // Verify the setting exists and is type "file"
    const fullKey = `plugin.${pluginId}.${settingKey}`;
    const settingRow = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, fullKey))
      .get();

    if (!settingRow || settingRow.type !== "file") {
      return NextResponse.json(
        { error: `Setting "${settingKey}" is not a file-type setting` },
        { status: 400 }
      );
    }

    // Check file size
    const validation = settingRow.validation
      ? JSON.parse(settingRow.validation)
      : {};
    const maxSize = validation.maxSize || 10 * 1024 * 1024; // 10 MB default

    if (file.size > maxSize) {
      const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB} MB.` },
        { status: 400 }
      );
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("utf-8");

    // Validate cookies format
    const formatCheck = validateCookiesFile(content);
    if (!formatCheck.valid) {
      return NextResponse.json(
        { error: formatCheck.error },
        { status: 400 }
      );
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.txt";

    // Write file to plugin data directory
    const dataDir = path.join(PLUGINS_DIR, pluginId, "data", settingKey);
    await fs.mkdir(dataDir, { recursive: true });

    // Remove any existing files in this setting's data dir
    try {
      const existing = await fs.readdir(dataDir);
      for (const f of existing) {
        await fs.unlink(path.join(dataDir, f));
      }
    } catch {
      // Directory may not exist yet
    }

    const filePath = path.join(dataDir, safeName);
    await fs.writeFile(filePath, buffer);

    // Update the setting value to the absolute path
    await setSetting(fullKey, filePath);

    return NextResponse.json({
      success: true,
      filename: safeName,
      path: filePath,
    });
  } catch (err) {
    console.error("Error uploading plugin file:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, settingKey } = body;

    if (!pluginId || !settingKey) {
      return NextResponse.json(
        { error: "pluginId and settingKey are required" },
        { status: 400 }
      );
    }

    if (!isValidSegment(pluginId) || !isValidSegment(settingKey)) {
      return NextResponse.json(
        { error: "Invalid pluginId or settingKey" },
        { status: 400 }
      );
    }

    const fullKey = `plugin.${pluginId}.${settingKey}`;
    const currentPath = getSetting<string>(fullKey);

    // Delete the file if it exists
    if (currentPath && currentPath !== "null") {
      // Ensure the path is within the expected data directory
      const expectedDir = path.join(PLUGINS_DIR, pluginId, "data", settingKey);
      const resolved = path.resolve(currentPath);
      if (resolved.startsWith(expectedDir)) {
        try {
          await fs.unlink(resolved);
        } catch {
          // File may already be deleted
        }
      }
    }

    // Also clean up any files in the data directory
    const dataDir = path.join(PLUGINS_DIR, pluginId, "data", settingKey);
    try {
      const files = await fs.readdir(dataDir);
      for (const f of files) {
        await fs.unlink(path.join(dataDir, f));
      }
    } catch {
      // Directory may not exist
    }

    // Clear the setting value
    await setSetting(fullKey, "");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting plugin file:", err);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
