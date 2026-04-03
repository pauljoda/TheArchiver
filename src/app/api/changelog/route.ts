import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const changelogPath = join(process.cwd(), "CHANGELOG.md");
    const content = await readFile(changelogPath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { error: "Changelog not found" },
      { status: 404 }
    );
  }
}
