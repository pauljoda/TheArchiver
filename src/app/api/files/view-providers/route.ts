import { NextRequest, NextResponse } from "next/server";
import { getViewProvidersForPath } from "@/plugins/registry";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "";

  try {
    const providers = getViewProvidersForPath(path);
    return NextResponse.json(providers);
  } catch {
    return NextResponse.json([]);
  }
}
