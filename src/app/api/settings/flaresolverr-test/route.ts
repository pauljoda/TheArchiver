import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { testConnection } from "@/plugins/helpers/flaresolverr";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fromBody =
      typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const baseUrl =
      fromBody ||
      getSetting<string>("core.flaresolverr_url")?.trim() ||
      "";

    if (!baseUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No FlareSolverr URL configured. Enter a URL in Core settings (or pass baseUrl in the JSON body).",
        },
        { status: 400 }
      );
    }

    const result = await testConnection(baseUrl);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
