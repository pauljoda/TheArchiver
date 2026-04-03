import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  getViewProviderEntry,
  getFilePreviewProviderEntry,
} from "@/plugins/registry";

export async function GET(req: NextRequest) {
  const pluginId = req.nextUrl.searchParams.get("pluginId");
  const type = req.nextUrl.searchParams.get("type");

  if (!pluginId) {
    return NextResponse.json({ error: "Missing pluginId" }, { status: 400 });
  }

  let entryPoint: string | null = null;

  if (type === "preview") {
    const entry = getFilePreviewProviderEntry(pluginId);
    if (entry) entryPoint = entry.entryPoint;
  } else {
    const entry = getViewProviderEntry(pluginId);
    if (entry) entryPoint = entry.entryPoint;
  }

  if (!entryPoint) {
    return NextResponse.json(
      { error: `${type || "view"} provider not found` },
      { status: 404 }
    );
  }

  if (!fs.existsSync(entryPoint)) {
    return NextResponse.json(
      { error: "Bundle not found on disk" },
      { status: 404 }
    );
  }

  const content = fs.readFileSync(entryPoint, "utf-8");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
