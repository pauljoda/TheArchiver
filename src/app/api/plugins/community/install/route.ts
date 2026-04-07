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
    const body = await request.json();
    const { downloadUrl } = body;

    if (!downloadUrl || typeof downloadUrl !== "string") {
      return NextResponse.json(
        { error: "downloadUrl is required" },
        { status: 400 }
      );
    }

    // Validate download URL against the trusted community registry base URL
    const communityUrl =
      process.env.COMMUNITY_PLUGINS_URL ||
      "https://raw.githubusercontent.com/pauljoda/TheArchiver-CommunityPlugins/main/plugins.json";
    try {
      const manifestRes = await fetch(communityUrl, { cache: "no-store" });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        if (manifest.baseUrl && !downloadUrl.startsWith(manifest.baseUrl)) {
          return NextResponse.json(
            { error: "downloadUrl must originate from the community registry" },
            { status: 400 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        { error: "Unable to verify download URL against community registry" },
        { status: 502 }
      );
    }

    // Download the ZIP from the community repo
    const zipRes = await fetch(downloadUrl);
    if (!zipRes.ok) {
      return NextResponse.json(
        { error: `Failed to download plugin: ${zipRes.status} ${zipRes.statusText}` },
        { status: 502 }
      );
    }

    // Write to temp file
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "archiver-community-"));
    const zipPath = path.join(tmpDir, "plugin.zip");
    const buffer = Buffer.from(await zipRes.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract and validate
    const extractDir = path.join(tmpDir, "extracted");
    const { rootDir, manifest } = await extractAndValidatePlugin(zipPath, extractDir);

    // Find existing plugin by slug ID or display name
    const slugId = slugify(manifest.name);
    const db = getDb();

    let existing = db
      .select()
      .from(schema.installedPlugins)
      .where(eq(schema.installedPlugins.id, slugId))
      .get();

    // Also search by display name in case the plugin was installed under a
    // different ID (e.g. directory-based ID from deploy scripts)
    if (!existing) {
      existing = db
        .select()
        .from(schema.installedPlugins)
        .where(eq(schema.installedPlugins.name, manifest.name))
        .get();
    }

    const pluginId = existing?.id ?? slugId;

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
    console.error("Error installing community plugin:", err);
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
