import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getPluginForUrl } from "@/plugins/registry";
import { emitSSEEvent } from "@/lib/events";
import { processNow } from "@/workers/download.worker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Check if a plugin exists for this URL
    const match = getPluginForUrl(url);
    const pluginName = match?.plugin.name || null;

    // Insert into database
    const db = getDb();
    const result = db
      .insert(schema.downloadQueue)
      .values({ url, pluginName })
      .returning()
      .get();

    // Wake the worker to pick up the new job
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
          : "Queued for download (no matching plugin found)",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error adding download:", err);
    return NextResponse.json(
      { error: "Failed to queue download" },
      { status: 500 }
    );
  }
}
