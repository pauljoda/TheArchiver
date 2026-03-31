import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getPluginForUrl } from "@/plugins/registry";
import { emitSSEEvent } from "@/lib/events";
import { processNow } from "@/workers/download.worker";

function queueDownload(url: string): NextResponse {
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const match = getPluginForUrl(url);
  const pluginName = match?.plugin.name || null;

  const db = getDb();
  const result = db
    .insert(schema.downloadQueue)
    .values({ url, pluginName })
    .returning()
    .get();

  processNow();

  emitSSEEvent({
    type: "job:added",
    data: { id: result.id, url, pluginName },
  });

  return NextResponse.json(
    {
      id: result.id,
      url,
      pluginName,
      message: match
        ? `Queued for download via ${match.plugin.name}`
        : "Queued for download (no matching plugin — enable the Files plugin for universal downloads)",
    },
    { status: 201 }
  );
}

/** GET /api/download?url=... — queue a download via query param */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")?.trim();
    if (!url) {
      return NextResponse.json(
        { error: "url query parameter is required" },
        { status: 400 }
      );
    }
    return queueDownload(url);
  } catch (err) {
    console.error("Error adding download:", err);
    return NextResponse.json(
      { error: "Failed to queue download" },
      { status: 500 }
    );
  }
}

/** POST /api/download { url: "..." } — queue a download via JSON body */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    return queueDownload(url);
  } catch (err) {
    console.error("Error adding download:", err);
    return NextResponse.json(
      { error: "Failed to queue download" },
      { status: 500 }
    );
  }
}
