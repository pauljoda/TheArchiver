import { NextRequest, NextResponse } from "next/server";
import { getFilePreviewProviderForExtension } from "@/plugins/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/plugins/preview-provider?ext=cbz
 *
 * Returns the pluginId that can preview a given file extension,
 * or 204 if no plugin handles it.
 */
export async function GET(req: NextRequest) {
  const ext = req.nextUrl.searchParams.get("ext");
  if (!ext) {
    return NextResponse.json({ error: "Missing ext" }, { status: 400 });
  }

  const provider = getFilePreviewProviderForExtension(ext);
  if (!provider) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ pluginId: provider.pluginId });
}
