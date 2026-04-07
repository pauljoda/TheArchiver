import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { slugify } from "@/plugins/helpers/string";
import {
  extractAndValidatePlugin,
  installPlugin,
  PluginInstallError,
} from "@/lib/plugin-install";

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "File must be a .zip archive" },
        { status: 400 }
      );
    }

    // Write upload to temp file
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "archiver-plugin-"));
    const zipPath = path.join(tmpDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract and validate
    const extractDir = path.join(tmpDir, "extracted");
    const { rootDir, manifest } = await extractAndValidatePlugin(zipPath, extractDir);

    // Check for existing plugin
    const pluginId = slugify(manifest.name);
    const db = getDb();
    const existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, pluginId))
      .get();

    // Install
    const result = await installPlugin(rootDir, manifest, {
      pluginId,
      existing: existing ? { id: existing.id, enabled: existing.enabled } : undefined,
    });

    return NextResponse.json(result, {
      status: result.updated ? 200 : 201,
    });
  } catch (err) {
    if (err instanceof PluginInstallError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Error installing plugin:", err);
    return NextResponse.json(
      { error: "Failed to install plugin" },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
