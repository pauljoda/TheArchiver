import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";

const COMMUNITY_REPO_URL =
  process.env.COMMUNITY_PLUGINS_URL ||
  "https://raw.githubusercontent.com/pauljoda/TheArchiver-CommunityPlugins/main/plugins.json";

interface CommunityPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadFile: string;
  path: string;
}

interface CommunityManifest {
  version: number;
  baseUrl: string;
  plugins: CommunityPlugin[];
}

export async function GET() {
  try {
    const res = await fetch(COMMUNITY_REPO_URL, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch community plugins" },
        { status: 502 }
      );
    }

    const manifest: CommunityManifest = await res.json();

    // Get installed plugins to determine status
    const db = getDb();
    const installed = db.select().from(schema.installedPlugins).all();
    const installedMap = new Map(installed.map((p) => [p.id, p]));

    // Also build a map by slugified name for matching plugins installed via
    // different methods (ZIP upload slugifies the manifest name, deploy scripts
    // use the directory name)
    const slugify = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const installedBySlug = new Map(
      installed.map((p) => [slugify(p.name), p])
    );

    const plugins = manifest.plugins.map((p) => {
      const existing =
        installedMap.get(p.id) ?? installedBySlug.get(slugify(p.name));
      return {
        ...p,
        installed: !!existing,
        installedVersion: existing?.version || null,
        updateAvailable: !!existing && existing.version !== p.version,
      };
    });

    return NextResponse.json({
      version: manifest.version,
      baseUrl: manifest.baseUrl,
      plugins,
    });
  } catch (err) {
    console.error("Error fetching community plugins:", err);
    return NextResponse.json(
      { error: "Failed to fetch community plugins" },
      { status: 500 }
    );
  }
}
