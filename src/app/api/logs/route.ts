import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const LOG_FILE = path.join(process.cwd(), ".next/dev/logs/next-development.log");

export async function GET() {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-500) // Only return last 500 lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { timestamp: "", source: "Server", level: "LOG", message: line };
        }
      });
    return NextResponse.json(lines);
  } catch {
    return NextResponse.json([]);
  }
}
