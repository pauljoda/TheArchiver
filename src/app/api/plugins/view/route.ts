import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getViewProviderEntry } from "@/plugins/registry";

export async function GET(req: NextRequest) {
  const pluginId = req.nextUrl.searchParams.get("pluginId");

  if (!pluginId) {
    return NextResponse.json({ error: "Missing pluginId" }, { status: 400 });
  }

  const entry = getViewProviderEntry(pluginId);
  if (!entry) {
    return NextResponse.json({ error: "View provider not found" }, { status: 404 });
  }

  const { entryPoint } = entry;

  if (!fs.existsSync(entryPoint)) {
    return NextResponse.json({ error: "View bundle not found" }, { status: 404 });
  }

  const content = fs.readFileSync(entryPoint, "utf-8");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
